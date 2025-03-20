import * as THREE from 'three'

export class ProximityScene {
  constructor(container) {
    this.container = container
    this.meshes = []

    if (container.querySelector('canvas')) {
      console.warn(
        'Container already has a canvas. Skipping ProximityScene initialization.'
      )
      return
    }

    this.init()
  }

  init() {
    try {
      this.initScene()
      this.initLights()
      this.initCube()
      this.initEventListeners()
      this.animate()
    } catch (error) {
      console.error('Error initializing ProximityScene:', error)
    }
  }

  initScene() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    this.camera.position.set(0, 0, 5)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(width, height)
    this.container.appendChild(this.renderer.domElement)
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x404040)
    this.scene.add(ambientLight)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(1, 1, 1)
    this.scene.add(light)
  }

  initCube() {
    const geometry = new THREE.BoxGeometry(1, 1, 1)
    const material = new THREE.MeshPhongMaterial({
      color: 0x00ff00,
      shininess: 100,
    })
    this.cube = new THREE.Mesh(geometry, material)
    this.scene.add(this.cube)
  }

  handleResize = () => {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  initEventListeners() {
    window.addEventListener('resize', this.handleResize)
  }

  removeEventListeners() {
    window.removeEventListener('resize', this.handleResize)
  }

  animate = () => {
    requestAnimationFrame(this.animate)

    // Rotate the cube
    if (this.cube) {
      this.cube.rotation.x += 0.01
      this.cube.rotation.y += 0.01
    }

    this.renderer.render(this.scene, this.camera)
  }

  rotateRoom = (axis, angle) => {
    if (this.cube) {
      switch (axis) {
        case 'x':
          this.cube.rotation.x += angle
          break
        case 'y':
          this.cube.rotation.y += angle
          break
        case 'z':
          this.cube.rotation.z += angle
          break
      }
    }
  }

  addPrimitive = (type, color = null) => {
    // In this scene, we just change the cube color if specified
    if (color && this.cube) {
      this.cube.material.color.set(color)
    }
  }

  dispose() {
    this.removeEventListeners()
    this.container.removeChild(this.renderer.domElement)
  }
}
