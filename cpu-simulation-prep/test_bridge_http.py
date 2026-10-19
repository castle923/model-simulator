"""HTTP recovery checks for the Gazebo bridge, without connecting to Gazebo."""
import io
import json
import threading
import unittest
from unittest.mock import patch
from urllib.error import HTTPError

from gazebo_camera_bridge import camera_http_policy, sync_scene


def failure(code, error=None):
    body=json.dumps({"error":error}).encode() if error else b"temporary deployment route not found"
    return HTTPError("https://example.test/api/camera",code,"error",{},io.BytesIO(body))


class EmptyScene:
    status=204
    def __enter__(self): return self
    def __exit__(self,*args): return False


class FiniteStop:
    def __init__(self,attempts): self.attempts=attempts;self.calls=0
    def wait(self,_seconds): self.calls+=1;return self.calls>self.attempts


class BridgeHttpTests(unittest.TestCase):
    def run_scene(self,attempts,responses):
        with patch("urllib.request.urlopen",side_effect=responses) as opened:
            sync_scene("https://example.test/api/camera",{"id":"test","key":"hidden"},FiniteStop(attempts),[None],threading.Lock(),[None,0,None],None,None,None,{})
        return opened.call_count

    def test_temporary_404_retries_and_polls_again(self):
        self.assertEqual(self.run_scene(2,[failure(404),EmptyScene()]),2)

    def test_expired_session_404_stops(self):
        self.assertEqual(self.run_scene(2,[failure(404,"세션 없음")]),1)

    def test_auth_error_stops_only_after_three_consecutive_failures(self):
        self.assertEqual(self.run_scene(5,[failure(403),failure(403),failure(403)]),3)
        terminal,state=camera_http_policy(failure(403))
        self.assertFalse(terminal)
        terminal,state=camera_http_policy(failure(404),state)
        self.assertFalse(terminal)
        terminal,state=camera_http_policy(failure(403),state)
        self.assertFalse(terminal)


if __name__=="__main__": unittest.main()
