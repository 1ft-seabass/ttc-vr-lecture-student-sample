const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  // 立方体(y=1.2)と同じ高さから水平に見る(非XR時のプレビュー用。見下ろす角度だと立方体が画面上部に寄って見えるため)
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1.2, -3), scene);
  camera.setTarget(new BABYLON.Vector3(0, 1.2, 0));
  camera.attachControl(canvas, true);

  // マウスホイールで前後移動(dolly)。VRモードに入った後は使われない
  // (WebXR側が専用のヘッドトラッキングカメラに切り替えるため)、
  // あくまでVRに入る前のデスクトッププレビュー用の操作。
  const WHEEL_SENSITIVITY = 0.002;
  canvas.addEventListener('wheel', (event) => {
    event.preventDefault();
    const forward = camera.getDirection(BABYLON.Axis.Z);
    const moveAmount = -event.deltaY * WHEEL_SENSITIVITY;
    camera.position.addInPlace(forward.scale(moveAmount));
  }, { passive: false });

  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);
  light.intensity = 0.8;

  // 回転する立方体のみ。床・スカイボックスは置かない(パススルーを覆わないため)
  const cube = BABYLON.MeshBuilder.CreateBox('cube', { size: 0.5 }, scene);
  cube.position = new BABYLON.Vector3(0, 1.2, 0);
  const cubeMat = new BABYLON.StandardMaterial('cubeMat', scene);
  cubeMat.diffuseColor = BABYLON.Color3.Blue();
  cube.material = cubeMat;

  // 往復時間を表示するテキストプレート(タップ時のみ更新)
  const latencyPlane = BABYLON.MeshBuilder.CreatePlane('latencyPlane', { width: 1, height: 0.4 }, scene);
  latencyPlane.position = new BABYLON.Vector3(0, 1.8, 0);
  latencyPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  const latencyTexture = new BABYLON.DynamicTexture('latencyTexture', { width: 512, height: 200 }, scene);
  const latencyMat = new BABYLON.StandardMaterial('latencyMat', scene);
  latencyMat.diffuseTexture = latencyTexture;
  latencyMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  latencyPlane.material = latencyMat;

  // サーバー時刻(JST)を常時表示するテキストプレート(Node-REDから1秒おきに配信)
  const clockPlane = BABYLON.MeshBuilder.CreatePlane('clockPlane', { width: 1.2, height: 0.3 }, scene);
  clockPlane.position = new BABYLON.Vector3(0, 2.3, 0);
  clockPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;
  const clockTexture = new BABYLON.DynamicTexture('clockTexture', { width: 512, height: 128 }, scene);
  const clockMat = new BABYLON.StandardMaterial('clockMat', scene);
  clockMat.diffuseTexture = clockTexture;
  clockMat.emissiveColor = new BABYLON.Color3(1, 1, 1);
  clockPlane.material = clockMat;

  cube.actionManager = new BABYLON.ActionManager(scene);
  cube.actionManager.registerAction(
    new BABYLON.ExecuteCodeAction(BABYLON.ActionManager.OnPickTrigger, onCubeSelect)
  );

  // AR(パススルー)モードで起動。床メッシュを渡さない
  // iPhone SafariのようにWebXR自体に非対応の端末では失敗するため、エラーは握りつぶす
  scene.createDefaultXRExperienceAsync({ uiOptions: { sessionMode: 'immersive-ar' } })
    .catch((error) => {
      console.warn('WebXR ARセッションを開始できませんでした(この端末は非対応の可能性があります):', error);
    });

  return { scene, cube, cubeMat, latencyTexture, clockTexture };
};

const { scene, cube, cubeMat, latencyTexture, clockTexture } = createScene();

// WebSocket接続の確立(ページ自体もNode-REDが配信しているため、ホスト名は現在のページに合わせる)
const wsProtocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${location.host}/ws/device-control`);

let sentAt = 0;

function onCubeSelect() {
  sentAt = performance.now();
  ws.send(JSON.stringify({ command: 'toggle' }));
}

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  // 1秒おきに配信されるサーバー時刻(JST)。タップとは無関係に常時更新する
  if (data.type === 'clock') {
    clockTexture.clear();
    clockTexture.drawText(data.serverTimeJST, null, null, 'bold 40px monospace', '#FFFFFF', '#222222', true);
    return;
  }

  const roundTripMs = Math.round(performance.now() - sentAt);

  cubeMat.diffuseColor = data.state === 'on'
    ? BABYLON.Color3.Yellow()
    : BABYLON.Color3.Blue();

  latencyTexture.clear();
  latencyTexture.drawText(`${roundTripMs} ms`, null, null, 'bold 60px monospace', '#FFFFFF', '#333333', true);
};

ws.onerror = (error) => {
  console.error('WebSocketエラー:', error);
};

engine.runRenderLoop(() => {
  cube.rotation.y += 0.01;
  scene.render();
});

window.addEventListener('resize', () => engine.resize());
