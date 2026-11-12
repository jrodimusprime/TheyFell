// The way down to a strongpoint's deep dugout: a corrugated-iron arch under an earth mound, sandbagged at the sides,
// a timber door frame, and inside it the stairwell going down into the dark. Men sent up to a forward spawn climb
// those stairs (the sim's _emerge): hidden under the black stairwell until their heads come up out of it.
// Local frame: the mouth at the origin, facing -Z (the sim's forward, -sin yaw, -cos yaw); the shelter runs back along +Z.
import * as THREE from 'three';

const L = 2.8, W = 1.05, DEEP = 3.4;
export class Dugouts {
  constructor(scene, dugouts, T) {
    const iron = new THREE.MeshStandardMaterial({ color: 0x45423c, roughness: 0.75, metalness: 0.35, side: THREE.DoubleSide });
    const earth = new THREE.MeshStandardMaterial({ color: 0x625545, roughness: 1, flatShading: true });
    const wood = new THREE.MeshStandardMaterial({ color: 0x5b4431, roughness: 0.95 });
    const bag = new THREE.MeshStandardMaterial({ color: 0xa8987a, roughness: 1, flatShading: true });
    const dark = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.BackSide, fog: false });
    const open = new THREE.MeshBasicMaterial({ visible: false }), dark2 = new THREE.MeshBasicMaterial({ color: 0x050403, side: THREE.DoubleSide, fog: false });
    const darkF = new THREE.MeshBasicMaterial({ color: 0x050403, fog: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    this.groups = [];
    for (const d of dugouts) {
      const g = new THREE.Group(); g.position.set(d.x, d.y, d.z); g.rotation.y = d.yaw; g.userData.dugout = d.name;
      const half = (r, len, mat) => { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 14, 1, true, Math.PI / 2, Math.PI), mat); m.rotation.x = Math.PI / 2; m.position.set(0, 0.75, L / 2); return m; };
      g.add(half(W + 0.05, L, iron));                                                    // the iron arch
      const mound = half(W + 0.7, L + 0.5, earth); mound.scale.set(1, 1, 0.75); mound.position.set(0, 0.6, L / 2 + 0.2); g.add(mound);   // earth heaped over it
      const back = new THREE.Mesh(new THREE.SphereGeometry(W + 0.55, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), earth); back.scale.set(1, 0.75, 0.6); back.position.set(0, 0.2, L + 0.5); g.add(back);
      for (const sx of [-1, 1]) {                                                        // the arch's feet: sandbag walls
        for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) { const b = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.24, 0.62), bag); b.position.set(sx * (W + 0.2), 0.12 + j * 0.24, 0.35 + i * 0.66 + (j % 2) * 0.12); b.rotation.y = (i * 7 + j * 3) % 5 * 0.03; g.add(b); }
        const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.9, 0.14), wood); post.position.set(sx * 0.93, 0.95, 0.02); g.add(post);
      }
      const lintel = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.16, 0.18), wood); lintel.position.set(0, 1.86, 0.02); g.add(lintel);
      // the dark: the stairwell (a black opening over the steps, which hides a man until his head comes up out of it) and
      // the inside of the shelter and the shaft below, seen from within as black walls (so a man coming up sees nothing
      // until he reaches the door)
      // (the stairwell sits just over the highest ground under it, so no ground pokes up through it)
      const fx = -Math.sin(d.yaw), fz = -Math.cos(d.yaw); let top = 0;
      if (T) for (let i = 0; i <= 4; i++) for (const sx of [-0.8, 0, 0.8]) { const zb = 0.1 + i * (L - 0.2) / 4, wx = d.x - fx * zb + fz * sx, wz = d.z - fz * zb - fx * sx; top = Math.max(top, T.height(wx, wz) - d.y); }
      const well = new THREE.Mesh(new THREE.PlaneGeometry(W * 1.9, L - 0.1), darkF); well.rotation.x = -Math.PI / 2; well.position.set(0, top + 0.04, L / 2); g.add(well);
      const lining = half(W - 0.03, L - 0.02, dark); lining.material = dark; g.add(lining);                                   // the arch's inside, black
      for (const sx of [-1, 1]) { const wl = new THREE.Mesh(new THREE.PlaneGeometry(L, 0.8 + DEEP), dark2); wl.rotation.y = -sx * Math.PI / 2; wl.position.set(sx * (W - 0.03), (0.75 - DEEP) / 2, L / 2); g.add(wl); }   // its sides, down the shaft
      const backU = new THREE.Mesh(new THREE.CircleGeometry(W - 0.03, 14, 0, Math.PI), dark2); backU.position.set(0, 0.75, L - 0.01); g.add(backU);
      const backL = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, 0.75 + DEEP), dark2); backL.position.set(0, (0.75 - DEEP) / 2, L - 0.01); g.add(backL);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, L), dark2); floor.rotation.x = -Math.PI / 2; floor.rotation.y = 0; floor.position.set(0, -DEEP, L / 2); floor.rotation.x = Math.PI / 2; g.add(floor);
      const sill = new THREE.Mesh(new THREE.PlaneGeometry(W * 2, DEEP + top), dark2); sill.position.set(0, (top - DEEP) / 2, 0.01); sill.rotation.y = Math.PI; g.add(sill);   // below ground at the front, closed
      g.traverse(o => { if (o.isMesh && o.material !== dark && o.material !== dark2 && o.material !== darkF) { o.castShadow = true; o.receiveShadow = true; } });
      scene.add(g); this.groups.push(g);
    }
  }
}
