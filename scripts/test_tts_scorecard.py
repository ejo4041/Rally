import tempfile
import unittest
import wave
import struct
import math
from pathlib import Path
from tts_scorecard import word_errors,audio_metrics
class ScoreTest(unittest.TestCase):
 def test_exact_and_punctuation(self):
  self.assertEqual(word_errors('We cannot release.','we cannot release!')['wer'],0)
 def test_condition_deletion_is_visible(self):
  row=word_errors('Release only after verification','Release verification')
  self.assertEqual(row['wordErrors'],2);self.assertEqual(row['wer'],.5)
  self.assertEqual([x['reference'] for x in row['errors']],['only','after'])
 def test_insertion_and_empty_reference(self):
  self.assertEqual(word_errors('No','No yes')['wordErrors'],1)
  with self.assertRaises(ValueError):word_errors('','test')
 def test_long_pause_is_visible_without_assigning_naturalness(self):
  with tempfile.TemporaryDirectory() as directory:
   path=Path(directory)/'test.wav'
   tone=[int(8000*math.sin(2*math.pi*440*i/16000)) for i in range(8000)]
   pcm=tone+[0]*6400+tone
   with wave.open(str(path),'wb') as output:
    output.setnchannels(1);output.setsampwidth(2);output.setframerate(16000);output.writeframes(struct.pack('<'+'h'*len(pcm),*pcm))
   result=audio_metrics(path,4)
   self.assertAlmostEqual(result['durationSeconds'],1.4)
   self.assertEqual(result['internalLowEnergyRunsAtLeast150ms'],[{'startSeconds':.5,'durationSeconds':.4}])
   self.assertEqual(result['clippedSampleFraction'],0)
   self.assertNotIn('naturalnessMOS',result)
if __name__=='__main__':unittest.main()
