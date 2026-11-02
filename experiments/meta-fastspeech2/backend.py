"""Isolated CPU inference from pinned Meta weights and upstream fairseq classes.

No fairseq package registration/import, training runtime, or neural G2P is used.
"""
import argparse
import ast
import contextlib
import hashlib
import importlib.util
import json
import logging
import math
from pathlib import Path
import sys
import time
from types import SimpleNamespace
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
from scipy.signal import resample_poly
import torch
import torch.onnx.operators
from torch import Tensor, nn
import torch.nn.functional as F

MODEL = "facebook/fastspeech2-en-ljspeech"
REVISION = "a3e3e5e2e62bb7ca7514b11aa469e9c5b01a20bf"
DEFAULT_MODEL_DIR = Path("/srv/hackathon/models/meta-fastspeech2")
VENDOR = Path(__file__).parent / "vendor"
MAX_PHONES = 300
MAX_FRAMES = 2500


def verify_files(root, manifest):
    for item in manifest["files"]:
        path = root / item["file"]
        with path.open("rb") as stream:
            digest = hashlib.file_digest(stream, "sha256").hexdigest()
        if digest != item["sha256"]:
            raise ValueError(f"hash_mismatch: {path.name}")


def upstream_definitions(filename, names, namespace):
    """Execute named original AST definitions; skip unrelated fairseq imports."""
    path = VENDOR / filename
    tree = ast.parse(path.read_text(), filename=str(path))
    selected = [node for node in tree.body if isinstance(
        node, (ast.ClassDef, ast.FunctionDef)) and node.name in names]
    if {node.name for node in selected} != set(names):
        raise ValueError(f"missing_upstream_definition: {filename}")
    exec(compile(ast.Module(body=selected, type_ignores=[]), str(path), "exec"), namespace)


class EncoderBase(nn.Module):
    def __init__(self, dictionary):
        super().__init__()


class AttentionBase(EncoderBase):
    def init_incremental_state(self):
        # The selected non-autoregressive CPU path never uses incremental state.
        pass


def make_positions(tensor, padding_idx, onnx_trace=False):
    mask = tensor.ne(padding_idx).int()
    return (torch.cumsum(mask, dim=1).type_as(mask) * mask).long() + padding_idx


def lengths_to_padding_mask(lengths):
    return torch.arange(lengths.max(), device=lengths.device).unsqueeze(0) >= lengths.unsqueeze(1)


def positional_embedding(num_embeddings, embedding_dim, padding_idx):
    return _NAMESPACE["SinusoidalPositionalEmbedding"](
        embedding_dim, padding_idx, num_embeddings + padding_idx + 1)


_NAMESPACE = dict(torch=torch, nn=nn, F=F, Tensor=Tensor, math=math,
                  Any=Any, Dict=Dict, List=List, Optional=Optional, Tuple=Tuple,
                  Parameter=nn.Parameter, logger=logging.getLogger(__name__),
                  FairseqEncoder=EncoderBase, FairseqIncrementalDecoder=AttentionBase,
                  quant_noise=lambda module, p, block_size: module,
                  LayerNorm=nn.LayerNorm,
                  lengths_to_padding_mask=lengths_to_padding_mask,
                  PositionalEmbedding=positional_embedding,
                  utils=SimpleNamespace(item=lambda x: x.item(),
                                        make_positions=make_positions,
                                        eval_str_dict=lambda x: None))


def load_upstream():
    verify_files(VENDOR, json.loads((VENDOR / "manifest.json").read_text()))
    for filename, names in [
        ("fairseq_dropout.py", ["FairseqDropout"]),
        ("multihead_attention.py", ["MultiheadAttention"]),
        ("sinusoidal_positional_embedding.py", ["SinusoidalPositionalEmbedding"]),
        ("tacotron2.py", ["Postnet"]),
        ("fastspeech2.py", ["model_init", "Embedding", "PositionwiseFeedForward",
                            "FFTLayer", "LengthRegulator", "VariancePredictor",
                            "VarianceAdaptor", "FastSpeech2Encoder", "base_architecture"]),
    ]:
        # Architecture registration is the only outer decorator on these definitions.
        _NAMESPACE["register_model_architecture"] = lambda *args: lambda fn: fn
        upstream_definitions(filename, names, _NAMESPACE)
    spec = importlib.util.spec_from_file_location("meta_fastspeech_hifigan", VENDOR / "hifigan.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module.Generator


class Backend:
    def __init__(self, model_dir=DEFAULT_MODEL_DIR, threads=2):
        started = time.monotonic()
        torch.set_num_threads(threads)
        torch.set_num_interop_threads(1)
        torch.manual_seed(0)
        model_dir = Path(model_dir)
        manifest = json.loads((model_dir / "manifest.json").read_text())
        if manifest["model"] != MODEL or manifest["revision"] != REVISION:
            raise ValueError("model_identity_mismatch")
        # Anchor hashes in the experiment, not only in the mutable model cache.
        pinned = json.loads((Path(__file__).parent / "model-manifest.json").read_text())
        if manifest != pinned:
            raise ValueError("manifest_mismatch")
        verify_files(model_dir, pinned)
        Generator = load_upstream()
        # The released checkpoint needs Namespace, but no OmegaConf objects.
        with torch.serialization.safe_globals([argparse.Namespace]):
            checkpoint = torch.load(model_dir / "pytorch_model.pt", map_location="cpu",
                                    weights_only=True, mmap=True)
        args = checkpoint["cfg"]["model"]
        _NAMESPACE["base_architecture"](args)
        symbols = ["<s>", "<pad>", "</s>", "<unk>"] + [
            line.split()[0] for line in (model_dir / "vocab.txt").read_text().splitlines()]
        self.vocab = {symbol: index for index, symbol in enumerate(symbols)}
        self.phones = set(symbols[4:])
        # __len__ uses the class, not a SimpleNamespace attribute.
        class Dictionary:
            def pad(self): return 1
            def __len__(self): return len(symbols)
        self.encoder = _NAMESPACE["FastSpeech2Encoder"](args, Dictionary(), None)
        state = {key.removeprefix("encoder."): value for key, value in checkpoint["model"].items()}
        self.encoder.load_state_dict(state, strict=True)
        self.encoder.float().eval()
        original_regulator = self.encoder.var_adaptor.length_regulator
        class BoundedRegulator(nn.Module):
            def forward(self, x, durations):
                frames = int(durations.sum().item())
                if frames < 1 or frames > MAX_FRAMES:
                    raise ValueError("output_frame_limit")
                return original_regulator(x, durations)
        self.encoder.var_adaptor.length_regulator = BoundedRegulator()
        self.vocoder = Generator(json.loads((model_dir / "hifigan.json").read_text()))
        vocoder_state = torch.load(model_dir / "hifigan.bin", map_location="cpu",
                                   weights_only=True, mmap=True)
        self.vocoder.load_state_dict(vocoder_state["generator"], strict=True)
        self.vocoder.float().eval()
        with contextlib.redirect_stdout(sys.stderr):
            self.vocoder.remove_weight_norm()
        stats = np.load(model_dir / "fbank_mfa_gcmvn_stats.npz")
        self.mean = torch.from_numpy(stats["mean"]).float().view(1, 1, -1)
        self.std = torch.from_numpy(stats["std"]).float().view(1, 1, -1)
        self.load_ms = round((time.monotonic() - started) * 1000)

    @torch.inference_mode()
    def synthesize(self, phones, prosody=None):
        started = time.monotonic()
        if not isinstance(phones, list) or not 1 <= len(phones) <= MAX_PHONES:
            raise ValueError("invalid_phones: expected 1..300 phone strings")
        if any(not isinstance(phone, str) or phone not in self.phones for phone in phones):
            unknown = [phone for phone in phones if not isinstance(phone, str) or phone not in self.phones]
            raise ValueError(f"unknown_phone: {unknown!r}")
        if prosody not in (None, {}):
            raise ValueError("unsupported_prosody")
        tokens = torch.tensor([[self.vocab[p] for p in phones] + [self.vocab["</s>"]]])
        t0 = time.monotonic()
        feat, post, lengths, logdur, pitch, energy = self.encoder(tokens)
        feat = (feat if post is None else post) * self.std + self.mean
        t1 = time.monotonic()
        wave = self.vocoder(feat.transpose(1, 2)).view(-1).numpy()
        t2 = time.monotonic()
        wave = resample_poly(wave, 320, 441).astype(np.float32)
        if not np.isfinite(wave).all() or not len(wave):
            raise ValueError("invalid_waveform")
        pcm = (np.clip(wave, -1, 1) * 32767).round().astype("<i2").tobytes()
        result = dict(sampleRate=16000, seconds=len(wave)/16000,
                      synthesisMs=round((time.monotonic()-started)*1000),
                      timings=dict(acousticMs=round((t1-t0)*1000),
                                   vocoderMs=round((t2-t1)*1000)),
                      melFrames=int(lengths[0]), phoneCount=len(phones),
                      peak=float(np.abs(wave).max()), rms=float(np.sqrt(np.mean(wave**2))))
        return pcm, result
