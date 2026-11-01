"""Offline guards for honest timeline and source-audio replacement."""
import copy
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location('live_edit', Path(__file__).with_name('assemble-live-demo.py'))
editor = importlib.util.module_from_spec(spec)
spec.loader.exec_module(editor)

class LiveEditTest(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory()
        self.addCleanup(self.directory.cleanup)
        self.old_root = editor.ROOT
        editor.ROOT = Path(self.directory.name)
        self.addCleanup(setattr, editor, 'ROOT', self.old_root)
        (editor.ROOT/'base.mp4').touch()
        (editor.ROOT/'clip.mp4').touch()
        self.data = {'version':1,'durationSeconds':180,'base':'base.mp4','output':'artifacts/edit.mp4','slots':[{'id':'voice','start':79.5,'end':85.44,'source':'clip.mp4','sourceStart':0,'useSourceAudio':True,'title':'Actual remote audio'}]}

    def inspect(self, path):
        return {'format':{'duration':180 if path.name == 'base.mp4' else 10},'streams':[{'codec_type':'video'},{'codec_type':'audio'}]}

    def test_real_clip_and_pending_slot_are_accepted(self):
        editor.validate(self.data,self.inspect)
        self.data['slots'][0]['source'] = None
        editor.validate(self.data,self.inspect)

    def test_overlap_and_duplicate_ids_rejected(self):
        self.data['slots'].append(copy.deepcopy(self.data['slots'][0]))
        with self.assertRaises(ValueError):editor.validate(self.data,self.inspect)
        self.data['slots'][1]['id'] = 'other'
        with self.assertRaisesRegex(ValueError,'disjoint'):editor.validate(self.data,self.inspect)

    def test_short_footage_and_missing_source_audio_rejected(self):
        self.data['slots'][0]['sourceStart'] = 9
        with self.assertRaisesRegex(ValueError,'too short'):editor.validate(self.data,self.inspect)
        self.data['slots'][0]['sourceStart'] = 0
        def no_audio(path):
            result = self.inspect(path)
            if path.name == 'clip.mp4':result['streams'] = [{'codec_type':'video'}]
            return result
        with self.assertRaisesRegex(ValueError,'audio missing'):editor.validate(self.data,no_audio)

    def test_source_audio_cannot_overlap_narration(self):
        self.data['slots'][0].update(start=50,end=55)
        with self.assertRaisesRegex(ValueError,'narration-free'):editor.validate(self.data,self.inspect)

    def test_original_and_tracked_output_preserved(self):
        self.data['output'] = 'base.mp4'
        with self.assertRaises(ValueError):editor.validate(self.data,self.inspect)
        self.data['output'] = 'docs/edit.mp4'
        with self.assertRaises(ValueError):editor.validate(self.data,self.inspect)

    def test_invalid_times_rejected(self):
        for value in [float('nan'),float('inf'),True,-1]:
            self.data['slots'][0]['start'] = value
            with self.assertRaises(ValueError):editor.validate(self.data,self.inspect)

    def test_test_footage_has_explicit_scope(self):
        self.data['slots'][0]['sourceKind'] = 'synthetic-test'
        editor.validate(self.data,self.inspect)
        self.data['slots'][0]['sourceKind'] = 'unknown'
        with self.assertRaisesRegex(ValueError, 'source kind'):editor.validate(self.data,self.inspect)

if __name__ == '__main__':unittest.main()
