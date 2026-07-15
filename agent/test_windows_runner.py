import threading
import unittest
from unittest.mock import patch

from windows_runner import Runner

from dependency_policy import validate_requirements
from docker_executor import execute_python
from pairing import token_from_installer_name


class DependencyPolicyTests(unittest.TestCase):
    def test_accepts_pinned_allowlisted_packages(self):
        self.assertEqual(validate_requirements('requests==2.32.3\nhttpx==0.28.1'), ['requests==2.32.3', 'httpx==0.28.1'])

    def test_rejects_unpinned_and_unknown_packages(self):
        with self.assertRaises(ValueError):
            validate_requirements('requests')
        with self.assertRaises(ValueError):
            validate_requirements('evil-package==1.0.0')

    def test_rejects_options_and_urls(self):
        for value in ('--extra-index-url https://example.com', 'demo @ https://example.com/a.whl', '-e ./package'):
            with self.assertRaises(ValueError):
                validate_requirements(value)


class PairingFilenameTests(unittest.TestCase):
    def test_extracts_pairing_token_from_personalized_setup(self):
        token = 'pair_' + 'a' * 43
        self.assertEqual(token_from_installer_name(f'BotForgeRunner-{token}.exe'), token)

    def test_ignores_invalid_filename(self):
        self.assertIsNone(token_from_installer_name('BotForgeRunner.exe'))


class RunnerReconnectTests(unittest.TestCase):
    @patch('windows_runner.Runner._write_config')
    @patch('windows_runner.save_agent_key')
    @patch('windows_runner.exchange_pairing_token')
    def test_pair_replaces_key_and_requests_live_reconnect(self, exchange, save_key, write_config):
        exchange.return_value = {"apiKey": "agt_" + "a" * 40, "agentId": "agent_new"}
        states = []
        runner = Runner(lambda state, detail: states.append((state, detail)), lambda _: None)

        runner.pair("pair_" + "b" * 43, "https://botforge.example")

        save_key.assert_called_once_with("agt_" + "a" * 40)
        write_config.assert_called_once_with("agent_new", "https://botforge.example")
        self.assertTrue(runner.reconnect_event.is_set())
        self.assertEqual(states[-1][0], "connecting")


class DockerCommandTests(unittest.TestCase):
    @patch('docker_executor.subprocess.run')
    @patch('docker_executor.subprocess.Popen')
    def test_container_has_hardening_flags(self, popen, run):
        process = popen.return_value
        process.poll.return_value = 0
        process.stdout.read.return_value = ''
        process.returncode = 0
        process.wait.return_value = 0
        run.return_value.returncode = 0
        run.return_value.stdout = ''
        run.return_value.stderr = ''
        execute_python('run_123', 'print(1)', '', threading.Event(), lambda _: None)
        command = popen.call_args.args[0]
        for flag in ('--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--memory=512m', '--cpus=1', '--pids-limit=256'):
            self.assertIn(flag, command)
        self.assertFalse(any('/var/run/docker.sock' in part for part in command))


if __name__ == '__main__':
    unittest.main()
