"""Pose protocol tests that do not start Gazebo or send network requests."""
import io
import json
import threading
import unittest
from unittest.mock import patch

from gazebo_camera_bridge import camera_http_policy, encode_frame, sync_poses


class Response:
    status=200
    def __init__(self, value): self.stream=io.BytesIO(json.dumps(value).encode())
    def __enter__(self): return self
    def __exit__(self,*args): return False
    def read(self,*args): return self.stream.read(*args)


class BridgeMotionTests(unittest.TestCase):
    def test_sparse_roster_uses_stable_model_names_and_acks_after_service(self):
        revision="00000000-0000-4000-8000-000000000001"
        batch={"revision":revision,"sequence":7,"robots":[{"id":2,"x":6.5,"y":.8,"yaw":0.5},{"id":4,"x":2.2,"y":1.1,"yaw":-1.0}]}
        state=[revision,0,0];latest=[b"old",1,revision,0];calls=[]
        def open_request(request,timeout):
            calls.append((request.full_url,request.data))
            return Response(batch if request.data is None else {"ok":True})
        with patch("urllib.request.urlopen",side_effect=open_request),patch("gazebo_camera_bridge.service",return_value=True) as service:
            sequence=sync_poses("https://example.test/api/camera",{"id":"session","key":"hidden"},revision,[2,4],0,state,threading.Lock(),latest)
        self.assertEqual(sequence,7)
        self.assertEqual(state,[revision,7,2])
        self.assertIsNone(latest[0])
        self.assertEqual(service.call_count,2)
        self.assertIn('name: "raspbot_proxy_1"',service.call_args_list[0].args[1])
        self.assertIn('name: "raspbot_proxy_3"',service.call_args_list[1].args[1])
        self.assertEqual(json.loads(calls[-1][1]),{"revision":revision,"sequence":7})

    def test_old_revision_and_old_sequence_do_not_move_models(self):
        revision="new";state=[revision,9,0];latest=[None,1,revision,9]
        for batch in ({"revision":"old","sequence":10,"robots":[]},{"revision":revision,"sequence":9,"robots":[]}):
            with self.subTest(batch=batch),patch("urllib.request.urlopen",return_value=Response(batch)) as opened,patch("gazebo_camera_bridge.service") as service:
                self.assertEqual(sync_poses("https://example.test/api/camera",{"id":"s","key":"k"},revision,[],9,state,threading.Lock(),latest),9)
                self.assertEqual(opened.call_count,1)
                service.assert_not_called()

    def test_roster_mismatch_rejects_before_moving(self):
        batch={"revision":"new","sequence":10,"robots":[{"id":1,"x":1,"y":1,"yaw":0}]}
        with patch("urllib.request.urlopen",return_value=Response(batch)),patch("gazebo_camera_bridge.service") as service:
            with self.assertRaises(ValueError): sync_poses("https://example.test/api/camera",{"id":"s","key":"k"},"new",[2],9,["new",0,0],threading.Lock(),[None,0,None,0])
            service.assert_not_called()

    def test_exact_output_resolution_and_jpeg_quality(self):
        try:
            from PIL import Image
        except ImportError:
            self.skipTest("Pillow is not installed in this Python; run under Ubuntu bridge runtime")
        class Msg:
            width=640;height=480;step=640*3;pixel_format_type=3
            data=bytes([30,80,120])*(640*480)
        jpeg=encode_frame(Msg())
        image=Image.open(io.BytesIO(jpeg))
        self.assertEqual(image.size,(640,480))
        self.assertEqual(image.format,"JPEG")
        self.assertLessEqual(len(jpeg),262144)


if __name__=="__main__": unittest.main()
