const canvas = document.getElementById('renderCanvas');
const engine = new BABYLON.Engine(canvas, true);

const createScene = () => {
  const scene = new BABYLON.Scene(engine);

  // カメラ(目線の高さに配置、固定視点)
  const camera = new BABYLON.FreeCamera('camera', new BABYLON.Vector3(0, 1.6, -5), scene);
  camera.setTarget(BABYLON.Vector3.Zero());

  // ライト
  const light = new BABYLON.HemisphericLight('light', new BABYLON.Vector3(0, 1, 0), scene);

  // 立方体の作成
  const cube = BABYLON.MeshBuilder.CreateBox('cube', { size: 1 }, scene);
  const material = new BABYLON.StandardMaterial('mat', scene);
  material.diffuseColor = new BABYLON.Color3(1, 0, 0); // 赤
  cube.material = material;

  // WebXR の有効化
  scene.createDefaultXRExperienceAsync({ floorMeshes: [] });

  // Inspector を常時表示(Ctrl+Shift+Alt+Iのショートカットはフォーカス状況により
  // 不安定なため使わない。不要な時はこの行をコメントアウトする)
  scene.debugLayer.show();

  return { scene, cube };
};

const { scene, cube } = createScene();

// アニメーションループ(立方体をY軸回転させる)
engine.runRenderLoop(() => {
  cube.rotation.y += 0.01;
  scene.render();
});

window.addEventListener('resize', () => engine.resize());
