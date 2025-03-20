import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import { PrimitiveFactory } from './PrimitiveFactory'

export class ProximityScene {
  constructor(container) {
    this.container = container
    this.meshes = []
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()
    this.selectedObject = null
    this.isDragging = false
    this.plane = new THREE.Plane()
    this.offset = new THREE.Vector3()

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
    this.scene.background = new THREE.Color(0xf0f0f0) // Light gray background
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    this.camera.position.set(0, 0, 5)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(width, height)
    this.container.appendChild(this.renderer.domElement)

    // Add orbit controls
    this.controls = new OrbitControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.05
    this.controls.screenSpacePanning = false
    this.controls.minDistance = 1
    this.controls.maxDistance = 50
    this.controls.maxPolarAngle = Math.PI / 1.5
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x404040)
    this.scene.add(ambientLight)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(1, 1, 1)
    this.scene.add(light)
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

    const canvas = this.renderer.domElement
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mouseup', this.handleMouseUp)
    canvas.addEventListener('mouseleave', this.handleMouseUp)
  }

  removeEventListeners() {
    window.removeEventListener('resize', this.handleResize)

    const canvas = this.renderer.domElement
    canvas.removeEventListener('mousedown', this.handleMouseDown)
    canvas.removeEventListener('mousemove', this.handleMouseMove)
    canvas.removeEventListener('mouseup', this.handleMouseUp)
    canvas.removeEventListener('mouseleave', this.handleMouseUp)
  }

  handleMouseDown = (event) => {
    // Check if we're clicking on an object
    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(this.meshes)

    if (intersects.length > 0) {
      // We clicked on an object, enable object dragging
      this.isDragging = true
      this.selectedObject = intersects[0].object

      // Store the controls state to restore it later
      this.controlsEnabled = this.controls.enabled

      // Calculate the offset and set up the drag plane
      this.plane.setFromNormalAndCoplanarPoint(
        this.camera.getWorldDirection(new THREE.Vector3()),
        this.selectedObject.position
      )

      const planeIntersect = new THREE.Vector3()
      this.raycaster.ray.intersectPlane(this.plane, planeIntersect)
      this.offset.copy(this.selectedObject.position).sub(planeIntersect)

      // Prevent orbit controls from moving the camera while dragging an object
      // but only if we actually hit an object
      if (this.controls) this.controls.enabled = false
    }
  }

  handleMouseMove = (event) => {
    if (!this.isDragging || !this.selectedObject) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)

    const planeIntersect = new THREE.Vector3()
    if (this.raycaster.ray.intersectPlane(this.plane, planeIntersect)) {
      this.selectedObject.position.copy(planeIntersect.add(this.offset))
    }
  }

  handleMouseUp = () => {
    if (this.isDragging) {
      // Only restore controls if we were dragging
      if (this.controls) this.controls.enabled = this.controlsEnabled
    }

    this.isDragging = false
    this.selectedObject = null
  }

  animate = () => {
    requestAnimationFrame(this.animate)
    if (this.controls) this.controls.update()
    this.renderer.render(this.scene, this.camera)
  }

  rotateRoom = (axis, angle) => {
    // Rotate all meshes in the scene
    if (this.meshes.length > 0) {
      this.meshes.forEach((mesh) => {
        switch (axis) {
          case 'x':
            mesh.rotation.x += angle
            break
          case 'y':
            mesh.rotation.y += angle
            break
          case 'z':
            mesh.rotation.z += angle
            break
        }
      })
    }
  }

  addPrimitive = (type, color = null) => {
    if (!this.scene) {
      console.error('Scene is not initialized')
      return
    }

    console.log('ProximityScene: Adding primitive', type, color)

    // Create the primitive using the factory
    const { mesh, type: primitiveType } = PrimitiveFactory.createPrimitive(
      type,
      color
    )

    // Position the mesh in front of the camera
    mesh.position.set(
      (Math.random() - 0.5) * 3,
      (Math.random() - 0.5) * 3,
      -2 + (Math.random() - 0.5)
    )

    // Add random rotation
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )

    // Add to scene
    this.scene.add(mesh)

    // Store in meshes array for potential future reference
    this.meshes.push(mesh)

    return mesh
  }

  dispose() {
    if (this.controls) this.controls.dispose()
    this.removeEventListeners()
    this.container.removeChild(this.renderer.domElement)
  }
}
