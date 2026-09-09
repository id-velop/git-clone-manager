"""Exercise prerequisite branches without downloading or installing real software."""
import os
from pathlib import Path
import subprocess
import tempfile
import unittest

SCRIPT = Path(__file__).resolve().parents[1] / 'scripts/install-companion.sh'
EXTENSION_ID = 'aamnpggmnckbdjbhecooigjddpnjffjl'


class CompanionInstallTests(unittest.TestCase):
    def run_install(self, missing=(), fail=False):
        with tempfile.TemporaryDirectory() as directory:
            root = Path(directory)
            bin_dir = root / 'bin'
            bin_dir.mkdir()
            for tool in ('node', 'git'):
                if tool not in missing:
                    (root / tool).touch()
            scripts = {
                'uname': 'echo Darwin',
                'node': 'test -f "$TEST_STATE/node"',
                'git': 'test -f "$TEST_STATE/git"',
                'brew': '''
if [[ "$1" == --prefix ]]; then echo "$TEST_STATE"; exit; fi
echo "$*" >> "$TEST_STATE/brew.log"
[[ "$TEST_FAIL" != yes ]] || exit 42
shift
for package in "$@"; do touch "$TEST_STATE/$package"; done
''',
                'curl': '''
while [[ $# -gt 0 ]]; do
  if [[ "$1" == -o ]]; then output="$2"; break; fi
  shift
done
if [[ "$output" == */install-native-host.sh ]]; then
  printf '%s\\n' 'test "$1" = aamnpggmnckbdjbhecooigjddpnjffjl || exit 7' 'touch "$TEST_STATE/registered"' > "$output"
else
  echo '// mock file' > "$output"
fi
''',
            }
            for name, body in scripts.items():
                target = bin_dir / name
                target.write_text('#!/bin/bash\n' + body + '\n')
                target.chmod(0o755)
            env = dict(os.environ, PATH=str(bin_dir) + ':/usr/bin:/bin',
                       TEST_STATE=str(root), TEST_FAIL='yes' if fail else 'no')
            result = subprocess.run(['bash', str(SCRIPT), EXTENSION_ID], env=env,
                                    capture_output=True, text=True)
            log = (root / 'brew.log').read_text() if (root / 'brew.log').exists() else ''
            return result, log, (root / 'registered').exists()

    def test_existing_dependencies_skip_brew(self):
        result, log, registered = self.run_install()
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(log, '')
        self.assertTrue(registered)

    def test_each_missing_dependency_is_installed(self):
        for missing in [('node',), ('git',), ('node', 'git')]:
            with self.subTest(missing=missing):
                result, log, registered = self.run_install(missing)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(log.strip(), 'install ' + ' '.join(missing))
                self.assertTrue(registered)

    def test_failed_dependency_install_does_not_register(self):
        result, _, registered = self.run_install(('node',), fail=True)
        self.assertNotEqual(result.returncode, 0)
        self.assertFalse(registered)


if __name__ == '__main__':
    unittest.main()
