"""Offline regression checks for source archive privacy and completeness."""
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
import zipfile

spec = importlib.util.spec_from_file_location('submission_export', Path(__file__).with_name('export_submission.py'))
exporter = importlib.util.module_from_spec(spec)
spec.loader.exec_module(exporter)

class SourceExportTest(unittest.TestCase):
    def test_runtime_credentials_and_symlinks_never_enter_source_archive(self):
        with tempfile.TemporaryDirectory() as directory:
            base = Path(directory)
            root = base / 'source'
            files = {
                'apps/rally/src/core.js': 'export const source = true;',
                'docs/attribution.md': 'Fixture license attribution',
                '.env.example': 'MODEL_API_KEY=',
                '.env.local': 'DO_NOT_EXPORT_KEY',
                'apps/rally/.dev.vars': 'DO_NOT_EXPORT_BINDINGS',
                'experiments/teams-web-client/state/profile/Default/Cookies': 'DO_NOT_EXPORT_COOKIE',
                'experiments/teams-web-client/state/profile/cache': 'DO_NOT_EXPORT_CACHE',
                'apps/rally/.wrangler/local-store': 'DO_NOT_EXPORT_RUNTIME',
                'apps/rally/node_modules/provider/index.js': 'DO_NOT_EXPORT_DEPS',
                'apps/rally/.data/store.sqlite': 'DO_NOT_EXPORT_DB',
                'apps/rally/.openai/hosting.json': json.dumps({'project_id':'private-project','d1':'DB'}),
            }
            for name, content in files.items():
                file = root / name
                file.parent.mkdir(parents=True, exist_ok=True)
                file.write_text(content)
            (root / 'linked-secret').symlink_to(root / '.env.local')
            original = exporter.ROOT
            try:
                exporter.ROOT = root
                out = base / 'source.zip'
                self.assertEqual(exporter.export(out), 4)
                with zipfile.ZipFile(out) as archive:
                    self.assertEqual(set(archive.namelist()), {'apps/rally/src/core.js','docs/attribution.md','.env.example','apps/rally/.openai/hosting.json'})
                    for name in archive.namelist():
                        self.assertNotIn(b'DO_NOT_EXPORT', archive.read(name))
                    self.assertEqual(json.loads(archive.read('apps/rally/.openai/hosting.json')), {'d1':'DB'})
                with self.assertRaises(ValueError):
                    exporter.export(root / 'recursive.zip')
            finally:
                exporter.ROOT = original

if __name__ == '__main__':
    unittest.main()
