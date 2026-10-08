import importlib.util
import tempfile
import unittest
from pathlib import Path

spec = importlib.util.spec_from_file_location("version_web", Path(__file__).resolve().parents[1] / "tools/version_web.py")
module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)


class VersionWebTest(unittest.TestCase):
    def test_entry_and_entire_module_graph_share_release(self):
        with tempfile.TemporaryDirectory() as tmp:
            root = Path(tmp)
            (root / "index.html").write_text('<script type="module" src="./src/main.js"></script><script type="module">import { R } from "./src/renderer.js";</script>')
            (root / "src").mkdir()
            (root / "src/main.js").write_text('import { R } from "./renderer.js"; import "../shared/data.js"; fetch("data/map.json");')
            (root / "src/renderer.js").write_text("export { X } from '../shared/dungeon.js';")
            self.assertEqual(module.version_web(root, "commit1"), 3)
            self.assertIn('./src/main.js?v=commit1', (root / "index.html").read_text())
            self.assertIn('./src/renderer.js?v=commit1', (root / "index.html").read_text())
            self.assertIn('../shared/data.js?v=commit1', (root / "src/main.js").read_text())
            self.assertIn('../shared/dungeon.js?v=commit1', (root / "src/renderer.js").read_text())
            self.assertIn('fetch("data/map.json")', (root / "src/main.js").read_text())
            self.assertEqual(module.version_web(root, "commit1"), 0)
            self.assertEqual(module.version_web(root, "commit2"), 3)
            self.assertNotIn('commit1', (root / "src/main.js").read_text())

    def test_rejects_invalid_revision(self):
        with self.assertRaises(ValueError):
            module.version_web(".", 'bad"revision')


if __name__ == "__main__":
    unittest.main()
