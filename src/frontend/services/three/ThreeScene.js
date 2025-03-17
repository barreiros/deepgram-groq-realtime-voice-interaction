import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as Ammo from 'ammo.js'

// Static physics objects to ensure we only initialize Ammo.js once
let physicsWorld = null
let transformAux = null

export class ThreeScene {
  constructor(container) {
    this.container = container
    this.meshes = []
    this.rigidBodies = []
    this.orbitRadius = 5
    this.orbitSpeed = 0.5
    this.raycaster = new THREE.Raycaster()
    this.mouse = new THREE.Vector2()

    // Check if we already have a renderer in the container
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
      this.initPhysics()
      this.initScene()
      this.initLights()
      this.initRoom()
      this.initEventListeners()
      this.animate()
    } catch (error) {
      console.error('Error initializing ThreeScene:', error)
    }
  }

  initPhysics() {
    // Only initialize physics once
    if (!physicsWorld) {
      console.log('Initializing Ammo.js physics')
      try {
        const collisionConfiguration =
          new Ammo.btDefaultCollisionConfiguration()
        const dispatcher = new Ammo.btCollisionDispatcher(
          collisionConfiguration
        )
        const broadphase = new Ammo.btDbvtBroadphase()
        const solver = new Ammo.btSequentialImpulseConstraintSolver()
        physicsWorld = new Ammo.btDiscreteDynamicsWorld(
          dispatcher,
          broadphase,
          solver,
          collisionConfiguration
        )
        physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0))
        transformAux = new Ammo.btTransform()
      } catch (error) {
        console.error('Error initializing Ammo.js physics:', error)
        throw error
      }
    }

    this.physicsWorld = physicsWorld
    this.transformAux = transformAux
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
      if (shape.setMargin) {
        shape.setMargin(0.05)
      }
      const transform = new Ammo.btTransform()
      transform.setIdentity()
      transform.setOrigin(new Ammo.btVector3(...wall.position))
      const motionState = new Ammo.btDefaultMotionState(transform)
      const rbInfo = new Ammo.btRigidBodyConstructionInfo(
        0,
        motionState,
        shape,
        new Ammo.btVector3(0, 0, 0)
      )
      const body = new Ammo.btRigidBody(rbInfo)
      body.setRestitution(1.0)
      this.physicsWorld.addRigidBody(body)
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

      const quaternion = new Ammo.btQuaternion(
        this.roomContainer.quaternion.x,
        this.roomContainer.quaternion.y,
        this.roomContainer.quaternion.z,
        this.roomContainer.quaternion.w
      )

      this.physicsWorld.setGravity(
        new Ammo.btVector3(
          -9.8 * Math.sin(this.roomContainer.rotation.z),
          -9.8 *
            Math.cos(this.roomContainer.rotation.x) *
            Math.cos(this.roomContainer.rotation.z),
          -9.8 * Math.sin(this.roomContainer.rotation.x)
        )
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

      this.physicsWorld.setGravity(
        new Ammo.btVector3(
          -9.8 * Math.sin(this.roomContainer.rotation.z),
          -9.8 *
            Math.cos(this.roomContainer.rotation.x) *
            Math.cos(this.roomContainer.rotation.z),
          -9.8 * Math.sin(this.roomContainer.rotation.x)
        )
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
      this.rigidBodies.map((body) => body.mesh)
    )

    if (intersects.length > 0) {
      const clickedMesh = intersects[0].object
      const clickedBody = this.rigidBodies.find(
        (body) => body.mesh === clickedMesh
      )

      if (clickedBody) {
        const force = new Ammo.btVector3(
          (Math.random() - 0.5) * 20,
          10,
          (Math.random() - 0.5) * 20
        )
        const worldPoint = new Ammo.btVector3(
          clickedMesh.position.x,
          clickedMesh.position.y,
          clickedMesh.position.z
        )
        clickedBody.applyImpulse(force, worldPoint)
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
    if (this.physicsWorld) {
      this.physicsWorld.stepSimulation(1 / 60, 10)

      this.rigidBodies.forEach((body) => {
        const ms = body.motionState
        if (ms) {
          ms.getWorldTransform(this.transformAux)
          const p = this.transformAux.getOrigin()
          const q = this.transformAux.getRotation()
          body.mesh.position.set(p.x(), p.y(), p.z())
          body.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w())
        }
      })
    }

    this.renderer.render(this.scene, this.camera)
  }

  addPrimitive = (type) => {
    console.log('ThreeScene.addPrimitive called with type:', type)
    console.log('this.scene:', this.scene)
    console.log('this.physicsWorld:', this.physicsWorld)

    if (!this.scene || !this.physicsWorld) {
      console.error('Scene or physicsWorld is not initialized')
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
      color: Math.random() * 0xffffff,
      shininess: 100,
    })
    const mesh = new THREE.Mesh(geometry, material)
    mesh.position.set(0, 3, 0)
    mesh.rotation.set(
      Math.random() * Math.PI,
      Math.random() * Math.PI,
      Math.random() * Math.PI
    )
    if (shape.setMargin) {
      shape.setMargin(0.05)
    }

    const transform = new Ammo.btTransform()
    transform.setIdentity()
    transform.setOrigin(
      new Ammo.btVector3(mesh.position.x, mesh.position.y, mesh.position.z)
    )

    const motionState = new Ammo.btDefaultMotionState(transform)
    const mass = type === 'torus' ? 2 : 1
    const localInertia = new Ammo.btVector3(0, 0, 0)
    shape.calculateLocalInertia(mass, localInertia)

    const rbInfo = new Ammo.btRigidBodyConstructionInfo(
      mass,
      motionState,
      shape,
      localInertia
    )
    const body = new Ammo.btRigidBody(rbInfo)
    body.setFriction(0.8)
    body.setRollingFriction(0.1)
    body.setRestitution(0.7)
    body.setDamping(0.1, 0.1)

    const velocity = new Ammo.btVector3(
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10,
      (Math.random() - 0.5) * 10
    )
    body.setLinearVelocity(velocity)
    body.setAngularVelocity(
      new Ammo.btVector3(
        Math.random() - 0.5,
        Math.random() - 0.5,
        Math.random() - 0.5
      )
    )
    body.setRestitution(1.0)

    this.physicsWorld.addRigidBody(body)
    body.mesh = mesh
    body.motionState = motionState

    this.rigidBodies.push(body)
    this.roomContainer.add(mesh)
  }

  dispose() {
    this.removeEventListeners()
    this.container.removeChild(this.renderer.domElement)
  }
}
