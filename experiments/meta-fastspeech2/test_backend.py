"""Focused integrity, token-boundary and protocol checks on the actual backend."""
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

from backend import Backend, DEFAULT_MODEL_DIR
from worker import bounded_lines, sentence_segments, synthesize_request, validate_request

ARTIFACTS = Path(__file__).resolve().parents[2] / "artifacts/feedback/phoneme-prototype"


class BoundaryTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = Backend()

    def test_hash_failure_precedes_torch_load(self):
        ARTIFACTS.mkdir(parents=True, exist_ok=True)
        with tempfile.TemporaryDirectory(dir=ARTIFACTS) as directory:
            root = Path(directory)
            manifest = json.loads((DEFAULT_MODEL_DIR / "manifest.json").read_text())
            (root / "manifest.json").write_text(json.dumps(manifest))
            for item in manifest["files"]:
                target = root / item["file"]
                if target.name == "config.yaml":
                    target.write_text("corrupted")
                else:
                    target.symlink_to(DEFAULT_MODEL_DIR / item["file"])
            # A second constructor must not reconfigure process-global interop
            # threads. Only exercise verification before any deserialization.
            with patch("torch.set_num_interop_threads"), patch("torch.load") as load:
                with self.assertRaisesRegex(ValueError, "hash_mismatch"):
                    Backend(root)
                load.assert_not_called()

    def test_unknown_and_control_symbols_rejected(self):
        for token in ["BOGUS", "</s>", "<s>", "<unk>", "<pad>", "ah0", "AH", "AA3", " ", 42]:
            with self.subTest(token=token), self.assertRaisesRegex(ValueError, "unknown_phone"):
                self.backend.synthesize([token])

    def test_phone_count_and_prosody(self):
        for phones in [[], ["AH0"] * 301, "AH0"]:
            with self.assertRaisesRegex(ValueError, "invalid_phones"):
                self.backend.synthesize(phones)
        for prosody in [{"speakingRate": 1.1}, [], False]:
            with self.assertRaisesRegex(ValueError, "unsupported_prosody"):
                self.backend.synthesize(["AH0"], prosody)

    def test_eos_appended_once(self):
        original = self.backend.encoder.forward
        seen = []
        def capture(tokens):
            seen.append(tokens.tolist()[0])
            return original(tokens)
        with patch.object(self.backend.encoder, "forward", side_effect=capture):
            pcm, result = self.backend.synthesize(["HH", "AH0", "L", "OW1"])
        self.assertEqual(seen, [[self.backend.vocab[p] for p in ["HH", "AH0", "L", "OW1"]] + [2]])
        self.assertEqual(len(pcm), round(result["seconds"] * 16000) * 2)
        self.assertGreater(result["rms"], 0)

    def test_request_boundary(self):
        self.assertEqual(validate_request({"id": "ok", "inputKind": "arpabet", "text": "Hello."}), "ok")
        for request in [[], {}, {"id": ""}, {"id": 1}, {"id": "x"*81}, {"id": "x\n"},
                        {"id": "ok", "text": "a\x00b"}, {"id": "ok", "inputKind": "ipa"}]:
            with self.subTest(request=request), self.assertRaises(ValueError):
                validate_request(request)

    def test_oversize_line_recovers_at_next_request(self):
        stream = io.StringIO("x"*180000 + "\n" + '{"id":"next"}\n')
        self.assertEqual(list(bounded_lines(stream)), [None, '{"id":"next"}\n'])

    def test_sentence_contract_before_inference(self):
        good = dict(phones=["HH", "AH0"], sentences=[
            dict(phones=["HH"], pauseMs=300), dict(phones=["AH0"], pauseMs=0)])
        self.assertEqual(sentence_segments(good, self.backend), good["sentences"])
        cases = [dict(good, sentences=[]), dict(good, sentences=[dict(phones=["HH"], pauseMs=0)]),
                 dict(good, sentences=[dict(phones=["HH", "AH0"], pauseMs=True)]),
                 dict(good, sentences=[dict(phones=["HH", "AH0"], pauseMs=301)]),
                 dict(good, sentences=[dict(phones=[], pauseMs=0)]),
                 dict(good, sentences=[dict(phones=["HH", "AH0"], pauseMs=0, text="a\x00b")])]
        with patch.object(self.backend, "synthesize") as synthesize:
            for request in cases:
                with self.subTest(request=request), self.assertRaises(ValueError):
                    synthesize_request(self.backend, request)
            synthesize.assert_not_called()

    def test_sentence_join_pcm_and_single_sentence_identity(self):
        phones = ["HH", "AH0", "L", "OW1"]
        pcm, original = self.backend.synthesize(phones)
        with patch.object(self.backend, "synthesize", return_value=(pcm, original)):
            single_pcm, single = synthesize_request(self.backend, dict(
                phones=phones, sentences=[dict(phones=phones, pauseMs=0)]))
            joined_pcm, joined = synthesize_request(self.backend, dict(
                phones=phones*2, sentences=[dict(phones=phones, pauseMs=300), dict(phones=phones, pauseMs=0)]))
        self.assertEqual(single_pcm, pcm)
        self.assertEqual(single["seconds"], original["seconds"])
        self.assertEqual(len(joined_pcm), len(pcm)*2+9600)
        self.assertEqual(joined_pcm[len(pcm):len(pcm)+9600], bytes(9600))
        self.assertEqual(joined["phrases"][1]["startSeconds"], original["seconds"]+.3)
        self.assertAlmostEqual(joined["seconds"], original["seconds"]*2+.3)

    def test_joined_output_limit(self):
        original = dict(melFrames=2000, timings=dict(acousticMs=0, vocoderMs=0))
        with patch.object(self.backend, "synthesize", return_value=(bytes(31*32000), original)):
            with self.assertRaisesRegex(ValueError, "output_limit"):
                synthesize_request(self.backend, dict(phones=["AH0"], sentences=[dict(phones=["AH0"], pauseMs=0)]))


if __name__ == "__main__":
    unittest.main()
