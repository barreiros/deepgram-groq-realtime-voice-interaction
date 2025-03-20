import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as Ammo from 'ammo.js'
import { PhysicsEngine } from './PhysicsEngine'

export class ThreeScene {
  constructor(container) {
    this.container = container
    this.meshes = []
    this.orbitRadius = 5
    this.orbitSpeed = 0.5
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    if (container.querySelector('canvas')) {
      console.warn(
        'Container already has a canvas. Skipping ThreeScene initialization.'
      )
      return
    }

    this.init()
  }

  init() {
    try {
      this.physics = new PhysicsEngine()
      this.initScene()
      this.initLights()
      this.initRoom()
      this.initEventListeners()
      this.animate()
    } catch (error) {
      console.error('Error initializing ThreeScene:', error)
    }
  }

  initScene() {
    const width = this.container.clientWidth
    const height = this.container.clientHeight

    this.scene = new THREE.Scene()
    this.camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000)
    this.camera.position.set(0, 0, 25)

    this.renderer = new THREE.WebGLRenderer({ antialias: true })
    this.renderer.setSize(width, height)
    this.container.appendChild(this.renderer.domElement)
    this.isDragging = false
    this.previousMousePosition = { x: 0, y: 0 }
  }

  initLights() {
    const ambientLight = new THREE.AmbientLight(0x404040)
    this.scene.add(ambientLight)

    const light = new THREE.DirectionalLight(0xffffff, 1)
    light.position.set(1, 1, 1)
    this.scene.add(light)
  }

  initRoom() {
    this.roomContainer = new THREE.Group()
    this.roomContainer.position.y = 0
    this.scene.add(this.roomContainer)

    const roomSize = 10
    const wallThickness = 0.5
    const walls = [
      {
        size: [roomSize, wallThickness, roomSize],
        position: [0, -5, 0],
        rotation: [0, 0, 0],
      },
      {
        size: [roomSize, wallThickness, roomSize],
        position: [0, 5, 0],
        rotation: [0, 0, 0],
      },
      {
        size: [roomSize, roomSize, wallThickness],
        position: [0, 0, -roomSize / 2],
        rotation: [0, 0, 0],
      },
      {
        size: [roomSize, roomSize, wallThickness],
        position: [0, 0, roomSize / 2],
        rotation: [0, 0, 0],
      },
      {
        size: [wallThickness, roomSize, roomSize],
        position: [-roomSize / 2, 0, 0],
        rotation: [0, 0, 0],
      },
      {
        size: [wallThickness, roomSize, roomSize],
        position: [roomSize / 2, 0, 0],
        rotation: [0, 0, 0],
      },
    ]

    walls.forEach((wall) => {
      const geometry = new THREE.BoxGeometry(...wall.size)
      const material = new THREE.MeshPhongMaterial({
        color: 0x808080,
        transparent: true,
        opacity: 0.2,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(...wall.position)
      mesh.rotation.set(...wall.rotation)
      this.roomContainer.add(mesh)

      const shape = new Ammo.btBoxShape(
        new Ammo.btVector3(wall.size[0] / 2, wall.size[1] / 2, wall.size[2] / 2)
      )
      this.physics.createRigidBody(mesh, shape, 0, {
        x: wall.position[0],
        y: wall.position[1],
        z: wall.position[2],
      })
    })
  }

  rotateRoom = (axis, angle) => {
    if (this.roomContainer) {
      switch (axis) {
        case 'x':
          this.roomContainer.rotation.x += angle
          break
        case 'y':
          this.roomContainer.rotation.y += angle
          break
        case 'z':
          this.roomContainer.rotation.z += angle
          break
      }

      this.physics.setGravity(
        -9.8 * Math.sin(this.roomContainer.rotation.z),
        -9.8 *
          Math.cos(this.roomContainer.rotation.x) *
          Math.cos(this.roomContainer.rotation.z),
        -9.8 * Math.sin(this.roomContainer.rotation.x)
      )
    }
  }

  handleMouseDown = (event) => {
    this.isDragging = true
    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    }
  }

  handleMouseMove = (event) => {
    if (!this.isDragging) return

    const deltaMove = {
      x: event.clientX - this.previousMousePosition.x,
      y: event.clientY - this.previousMousePosition.y,
    }

    if (this.roomContainer) {
      this.roomContainer.rotation.y += deltaMove.x * 0.005
      this.roomContainer.rotation.x += deltaMove.y * 0.005

      this.physics.setGravity(
        -9.8 * Math.sin(this.roomContainer.rotation.z),
        -9.8 *
          Math.cos(this.roomContainer.rotation.x) *
          Math.cos(this.roomContainer.rotation.z),
        -9.8 * Math.sin(this.roomContainer.rotation.x)
      )
    }

    this.previousMousePosition = {
      x: event.clientX,
      y: event.clientY,
    }
  }

  handleMouseUp = () => {
    this.isDragging = false
  }

  handleClick = (event) => {
    if (this.isDragging) return

    const rect = this.renderer.domElement.getBoundingClientRect()
    this.mouse.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
    this.mouse.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

    this.raycaster.setFromCamera(this.mouse, this.camera)
    const intersects = this.raycaster.intersectObjects(
      this.physics.rigidBodies.map((body) => body.mesh)
    )

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      const clickedBody = this.physics.rigidBodies.find(
        (body) => body.mesh === clickedMesh
      )

      if (clickedBody) {
        this.physics.applyImpulse(
          clickedBody,
          {
            x: (Math.random() - 0.5) * 20,
            y: 10,
            z: (Math.random() - 0.5) * 20,
          },
          {
            x: clickedMesh.position.x,
            y: clickedMesh.position.y,
            z: clickedMesh.position.z,
          }
        )
      }
    }
  }

  handleResize = () => {
    const width = this.container.clientWidth
    const height = this.container.clientHeight
    this.renderer.setSize(width, height)
    this.camera.aspect = width / height
    this.camera.updateProjectionMatrix()
  }

  initEventListeners() {
    const canvas = this.renderer.domElement
    canvas.addEventListener('mousedown', this.handleMouseDown)
    canvas.addEventListener('mousemove', this.handleMouseMove)
    canvas.addEventListener('mouseup', this.handleMouseUp)
    canvas.addEventListener('mouseleave', this.handleMouseUp)
    canvas.addEventListener('click', this.handleClick)
    window.addEventListener('resize', this.handleResize)
  }

  removeEventListeners() {
    const canvas = this.renderer.domElement
    canvas.removeEventListener('mousedown', this.handleMouseDown)
    canvas.removeEventListener('mousemove', this.handleMouseMove)
    canvas.removeEventListener('mouseup', this.handleMouseUp)
    canvas.removeEventListener('mouseleave', this.handleMouseUp)
    canvas.removeEventListener('click', this.handleClick)
    window.removeEventListener('resize', this.handleResize)
  }

  animate = () => {
    requestAnimationFrame(this.animate)
    if (this.physics) {
      this.physics.update()
    }
    this.renderer.render(this.scene, this.camera)
  }

  addPrimitive = (type, color = null) => {
    if (!this.scene || !this.physics) {
      console.error('Scene or physics is not initialized')
      return
    }

    let geometry, shape
    switch (type) {
      case 'cube':
        geometry = new THREE.BoxGeometry(1, 1, 1)
        shape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5))
        break
      case 'sphere':
        geometry = new THREE.SphereGeometry(0.5, 32, 32)
        shape = new Ammo.btSphereShape(0.5)
        break
      case 'cone':
        geometry = new THREE.ConeGeometry(0.5, 1, 32)
        shape = new Ammo.btConeShape(0.5, 1)
        break
      case 'torus':
        geometry = new THREE.TorusGeometry(0.5, 0.2, 16, 100)
        shape = new Ammo.btBoxShape(new Ammo.btVector3(0.7, 0.7, 0.2))
        break
      default:
        geometry = new THREE.BoxGeometry(1, 1, 1)
        shape = new Ammo.btBoxShape(new Ammo.btVector3(0.5, 0.5, 0.5))
    }

    const material = new THREE.MeshPhongMaterial({
      color: color || Math.random() * 0xffffff,
      shininess: 100,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, 3, 0)
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )

    const body = this.physics.createRigidBody(
      mesh,
      shape,
      type === 'torus' ? 2 : 1,
      {
        x: mesh.position.x,
        y: mesh.position.y,
        z: mesh.position.z,
      }
    )

    const velocity = {
      x: (Math.random() - 0.5) * 10,
      y: (Math.random() - 0.5) * 10,
      z: (Math.random() - 0.5) * 10,
    }
    body.setLinearVelocity(
      new Ammo.btVector3(velocity.x, velocity.y, velocity.z)
    )
    body.setAngularVelocity(
      new Ammo.btVector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      )
    )

    this.roomContainer.add(mesh)
  }

  dispose() {
    this.removeEventListeners()
    this.container.removeChild(this.renderer.domElement)
  }
}
