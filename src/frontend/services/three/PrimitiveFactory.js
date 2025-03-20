import * as THREE from 'three'

export class PrimitiveFactory {
  static createPrimitive(type, color = null) {
    let geometry
    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1)
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 32)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100)
        break
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
    }

    const material = new THREE.MeshPhongMaterial({
      color: color || Math.random() * 0xffffff,
      shininess: 100,
    })
    const mesh = new THREE.Mesh(geometry, material)

    return { mesh, type }
  }
}
