const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  // カメラ(部屋の中央・目線の高さからスタート)
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1.6, 0), scene);
  camera.setTarget(new BABYLON.Vector3(0, 1.6, 1));
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

  // ライト
  const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.6;
  const pointLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(0, 2.8, 0), scene);
  pointLight.intensity = 0.6;

  // 教室の箱(第7回で使った形状を流用)
  const room = BABYLON.MeshBuilder.CreateBox('room', {
    width: 10, height: 3, depth: 10,
    sideOrientation: BABYLON.Mesh.BACKSIDE,
  }, scene);
  const roomMaterial = new BABYLON.StandardMaterial('roomMat', scene);
  roomMaterial.diffuseColor = new BABYLON.Color3(0.85, 0.83, 0.78);
  room.material = roomMaterial;
  room.position.y = 1.5;

  // 教壇(カメラのスタート位置から正面奥に見える位置に設置。幅50cm×奥行50cm×高さ1m)
  const podium = BABYLON.MeshBuilder.CreateBox('podium', { width: 0.5, depth: 0.5, height: 1 }, scene);
  const podiumMaterial = new BABYLON.StandardMaterial('podiumMat', scene);
  podiumMaterial.diffuseColor = new BABYLON.Color3(0.4, 0.28, 0.2);
  podium.material = podiumMaterial;
  podium.position = new BABYLON.Vector3(0, 0.5, 4);

  // 2台のセンサー(教壇に向かって右側窓際の前方・後方)の表示設定
  // カメラは(0, 1.6, 0)から+z方向を向いてスタートし、その先(z=4)に教壇がある想定。
  // 「前方」は教壇に近い側の壁際(z=5の壁からは少し離す)、
  // 「後方」は教室反対側(後方の壁、z=-5)付近に、それぞれ壁にめり込まない余裕を持たせて配置
  const SENSOR_CONFIG = {
    sensor1: { label: '前方', position: new BABYLON.Vector3(3.5, 2, 4.0), color: new BABYLON.Color3(1, 0, 0) },
    sensor2: { label: '後方', position: new BABYLON.Vector3(3.5, 2, -4.0), color: new BABYLON.Color3(0, 0, 1) },
  };

  const sensorDisplays = {};

  for (const [sensorId, config] of Object.entries(SENSOR_CONFIG)) {
    const textPlane = BABYLON.MeshBuilder.CreatePlane(`textPlane_${sensorId}`, { width: 2, height: 1 }, scene);
    textPlane.position = config.position;
    textPlane.billboardMode = BABYLON.Mesh.BILLBOARDMODE_ALL;

    const textTexture = new BABYLON.DynamicTexture(`textTexture_${sensorId}`, { width: 512, height: 256 }, scene);
    textTexture.hasAlpha = true;
    const textMaterial = new BABYLON.StandardMaterial(`textMat_${sensorId}`, scene);
    textMaterial.diffuseTexture = textTexture;
    textMaterial.useAlphaFromDiffuseTexture = true;
    textMaterial.backFaceCulling = false;
    textMaterial.specularColor = new BABYLON.Color3(0, 0, 0); // 白く光る反射(スペキュラー)を消す
    textPlane.material = textMaterial;

    const decorCube = BABYLON.MeshBuilder.CreateBox(`decorCube_${sensorId}`, { size: 0.5 / 2 }, scene);
    // テキストプレートの真下に配置する(Y軸オフセットはビルボード回転の影響を受けないため安定する)
    decorCube.position = config.position.add(new BABYLON.Vector3(0, -0.7, 0));
    const decorMaterial = new BABYLON.StandardMaterial(`decorMat_${sensorId}`, scene);
    decorMaterial.diffuseColor = config.color;
    decorCube.material = decorMaterial;

    sensorDisplays[sensorId] = { textTexture, decorCube };
  }

  scene.createDefaultXRExperienceAsync({ floorMeshes: [room] });
  scene.debugLayer.show(); // Inspector常時表示(不要な場合はコメントアウト)

  return { scene, sensorDisplays, SENSOR_CONFIG };
};

const { scene, sensorDisplays, SENSOR_CONFIG } = createScene();

const API_ENDPOINT = '/api/sensors';
const UPDATE_INTERVAL = 5000;
const SENSOR_IDS = ['sensor1', 'sensor2'];

async function getSensorData(sensorId, maxRetries = 3) {
  let retries = 0;
  while (retries < maxRetries) {
    try {
      const response = await fetch(`${API_ENDPOINT}/${sensorId}`);
      if (!response.ok) throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      return await response.json();
    } catch (error) {
      retries++;
      console.warn(`取得失敗 (${retries}/${maxRetries}):`, error.message);
      if (retries >= maxRetries) {
        console.error('最大リトライ回数に達しました');
        const { textTexture } = sensorDisplays[sensorId];
        const { width, height } = textTexture.getSize();
        textTexture.getContext().clearRect(0, 0, width, height);
        textTexture.drawText('取得エラー', null, null, 'bold 60px monospace', '#FF0000', null, true);
        return null;
      }
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
  }
}

function parseSensorData(data) {
  const temperature = typeof data.value === 'number' ? data.value : null;
  const timestamp = data.timestamp ? new Date(data.timestamp) : null;
  return { temperature, timestamp };
}

function getTemperatureStatus(value) {
  if (value === null) return { label: '未取得' };
  if (value < 20) return { label: '低温' };
  if (value < 25) return { label: '正常' };
  return { label: '高温' };
}

function updateTemperatureDisplay(sensorId, value) {
  const { textTexture } = sensorDisplays[sensorId];
  const label = SENSOR_CONFIG[sensorId].label;
  const status = getTemperatureStatus(value);
  const displayValue = value === null ? '--' : value.toFixed(2);
  const { width, height } = textTexture.getSize();
  textTexture.getContext().clearRect(0, 0, width, height);
  textTexture.drawText(`${label} ${displayValue}°C (${status.label})`, null, null, 'bold 50px monospace', '#000000', null, true);
}

async function updateAllSensors() {
  try {
    for (const sensorId of SENSOR_IDS) {
      const rawData = await getSensorData(sensorId);
      if (!rawData) continue; // リトライしても取得できなかった場合はスキップ
      const parsed = parseSensorData(rawData);
      updateTemperatureDisplay(sensorId, parsed.temperature);
    }
    console.log('センサーデータ更新完了');
  } catch (error) {
    console.error('更新エラー:', error);
  }
}

let updateTimer = null;
function startUpdating() {
  if (updateTimer) return;
  updateAllSensors();
  updateTimer = setInterval(updateAllSensors, UPDATE_INTERVAL);
  console.log('自動更新を開始しました');
}
function stopUpdating() {
  if (updateTimer) {
    clearInterval(updateTimer);
    updateTimer = null;
    console.log('自動更新を停止しました');
  }
}

let debugMode = true;
function debugLog(message, data = null) {
  if (!debugMode) return;
  console.log(`[DEBUG] ${message}`, data || '');
}

startUpdating();

engine.runRenderLoop(() => {
  Object.values(sensorDisplays).forEach(({ decorCube }) => {
    decorCube.rotation.y += 0.01;
  });
  scene.render();
});

window.addEventListener('resize', () => engine.resize());
