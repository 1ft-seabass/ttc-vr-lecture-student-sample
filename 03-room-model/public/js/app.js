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

  // ライト(環境光 + 天井付近のポイントライト)
  const hemiLight = new BABYLON.HemisphericLight('hemiLight', new BABYLON.Vector3(0, 1, 0), scene);
  hemiLight.intensity = 0.6;

  const pointLight = new BABYLON.PointLight('pointLight', new BABYLON.Vector3(0, 2.8, 0), scene);
  pointLight.intensity = 0.6;

  // ---------------------------------------------------------
  // 教室の箱(完成部分。学生は編集しない)
  // 幅10m x 高さ3m x 奥行10m。BACKSIDEにすることで、
  // Boxの内側の面にマテリアルが貼られ、部屋の中にいるように見える。
  // ---------------------------------------------------------
  const room = BABYLON.MeshBuilder.CreateBox('room', {
    width: 10,
    height: 3,
    depth: 10,
    sideOrientation: BABYLON.Mesh.BACKSIDE,
  }, scene);
  const roomMaterial = new BABYLON.StandardMaterial('roomMat', scene);
  roomMaterial.diffuseColor = new BABYLON.Color3(0.85, 0.83, 0.78); // 内装風のオフホワイト
  room.material = roomMaterial;
  room.position.y = 1.5; // 床がY=0になるよう高さの半分だけ持ち上げる

  // ---------------------------------------------------------
  // 蛍光灯風の発光Box(完成部分。学生は編集しない)
  // 見た目上の光源(emissiveColor)を天井に2本配置する。
  // 実際の照明計算はhemiLight/pointLightが担っており、
  // このBox自体は「光っているように見せる」ための飾り。
  // ---------------------------------------------------------
  const createCeilingLightFixture = (x) => {
    const fixture = BABYLON.MeshBuilder.CreateBox(`lightFixture_${x}`, {
      width: 4,
      height: 0.1,
      depth: 0.3,
    }, scene);
    fixture.position = new BABYLON.Vector3(x, 2.95, 0);
    const fixtureMaterial = new BABYLON.StandardMaterial(`lightFixtureMat_${x}`, scene);
    fixtureMaterial.emissiveColor = new BABYLON.Color3(1, 1, 0.9);
    fixture.material = fixtureMaterial;
    return fixture;
  };
  createCeilingLightFixture(-2);
  createCeilingLightFixture(2);

  // WebXR の有効化
  scene.createDefaultXRExperienceAsync({ floorMeshes: [room] });

  // Inspector を常時表示(02-rotating-cubeと同様。不要な場合はコメントアウトする)
  scene.debugLayer.show();

  // ===========================================================
  // ここから先が「試してみよう」対象: 外部OBJモデルの読み込み
  // ===========================================================
  //
  // 教室モデル(room.obj / room.mtl / textures/)は講師から提供されるファイルを
  // public/models/ に配置して使う。ImportMeshAsync は非同期(Promise)なので、
  // 読み込み中も上のBoxの部屋・回転などは止まらずに動き続ける。
  BABYLON.SceneLoader.ImportMeshAsync('', 'models/', 'room.obj', scene)
    .then((result) => {
      // 読み込んだメッシュが複数に分かれていることが多いので、
      // TransformNode(空の親ノード)にまとめて、まとめて位置・スケールを操作できるようにする。
      const roomModelRoot = new BABYLON.TransformNode('roomModelRoot', scene);
      result.meshes.forEach((mesh) => {
        if (mesh.parent === null) {
          mesh.parent = roomModelRoot;
        }
      });

      // 読み込んだモデルのサイズを調べる(バウンディングボックス)。
      // CADから書き出したモデルはメートル換算になっていなかったり、
      // 原点が中央でなかったりすることがよくあるため、実測して調整する。
      const { min, max } = roomModelRoot.getHierarchyBoundingVectors();
      const size = max.subtract(min);
      const center = min.add(size.scale(0.5));

      // モデルの一番大きい辺が、教室の箱の奥行き(10m)に収まるようスケールを合わせる。
      const largestDimension = Math.max(size.x, size.y, size.z);
      if (largestDimension > 0) {
        const targetSize = 10;
        const scale = targetSize / largestDimension;
        roomModelRoot.scaling.setAll(scale);
      }

      // 原点をモデルの中心(X, Z)・床(Y=min)に合わせて補正する。
      // これをやらないと、モデルが部屋の隅にずれていたり、
      // 床にめり込んでいたりすることがある。
      roomModelRoot.position.x = -center.x * roomModelRoot.scaling.x;
      roomModelRoot.position.z = -center.z * roomModelRoot.scaling.z;
      roomModelRoot.position.y = -min.y * roomModelRoot.scaling.y;
    })
    .catch((error) => {
      // モデルファイルが無い/壊れている場合のフォールバック。
      // 「箱の部屋だけは必ず表示される」状態を保証しておくと、
      // 教材として動作確認しやすい。
      console.warn('room.obj の読み込みに失敗しました。簡易Boxを代わりに表示します。', error);
      const fallbackBox = BABYLON.MeshBuilder.CreateBox('fallbackBox', { size: 1 }, scene);
      fallbackBox.position.y = 0.5;
      const fallbackMaterial = new BABYLON.StandardMaterial('fallbackMat', scene);
      fallbackMaterial.diffuseColor = new BABYLON.Color3(0.6, 0.6, 0.6);
      fallbackBox.material = fallbackMaterial;
    });

  return scene;
};

const scene = createScene();

engine.runRenderLoop(() => {
  scene.render();
});

window.addEventListener('resize', () => engine.resize());
