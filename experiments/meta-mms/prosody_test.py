import unittest
from prosody import phrases
class ProsodyTest(unittest.TestCase):
 def test_sentence_boundaries_survive(self):
  self.assertEqual(phrases('Release only after verification. Priya owns it? Sam agrees!'),[{'text':'Release only after verification.','pauseMs':300},{'text':'Priya owns it?','pauseMs':300},{'text':'Sam agrees!','pauseMs':0}])
 def test_dates_versions_names_not_rewritten(self):
  self.assertEqual([p['text'] for p in phrases('Dr. Priya uses Spark 1.3 at 3:30. Do not release yet.')],['Dr. Priya uses Spark 1.3 at 3:30.','Do not release yet.'])
 def test_bounded_pause(self):
  for p in [-1,0,651,float('nan')]:
   with self.assertRaises(ValueError):phrases('Test.',p)
if __name__=='__main__':unittest.main()
