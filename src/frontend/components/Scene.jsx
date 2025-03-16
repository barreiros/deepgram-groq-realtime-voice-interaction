import React, { useEffect, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'
import * as Ammo from 'ammo.js'

const Scene = React.forwardRef((props, ref) => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const meshesRef = useRef([])
  const physicsWorldRef = useRef(null)
  const rigidBodiesRef = useRef([])
  const transformAuxRef = useRef(null)
  const raycasterRef = useRef(new THREE.Raycaster())
  const mouseRef = useRef(new THREE.Vector2())
  const orbitRadiusRef = useRef(5)
  const orbitSpeedRef = useRef(0.5)

  useEffect(() => {
    const initScene = () => {
      const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
      const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
      const broadphase = new Ammo.btDbvtBroadphase()
      const solver = new Ammo.btSequentialImpulseConstraintSolver()
      const physicsWorld = new Ammo.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
      )
      physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0))
      physicsWorldRef.current = physicsWorld
      transformAuxRef.current = new Ammo.btTransform()

      const mount = mountRef.current
      const width = mount.clientWidth
      const height = mount.clientHeight

      const scene = new THREE.Scene()
      sceneRef.current = scene

      const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
      camera.position.set(0, 5, 10)
      cameraRef.current = camera

      const renderer = new THREE.WebGLRenderer({ antialias: true })
      renderer.setSize(width, height)
      mount.appendChild(renderer.domElement)
      rendererRef.current = renderer

      const ambientLight = new THREE.AmbientLight(0x404040)
      scene.add(ambientLight)

      const light = new THREE.DirectionalLight(0xffffff, 1)
      light.position.set(1, 1, 1)
      scene.add(light)

      const controls = new OrbitControls(camera, renderer.domElement)
      controls.enableDamping = true
      controlsRef.current = controls

      // Create room
      const roomSize = 10
      const wallThickness = 0.5
      const walls = [
        // Ground
        {
          size: [roomSize, wallThickness, roomSize],
          position: [0, -2, 0],
          rotation: [0, 0, 0],
        },
        // Ceiling
        {
          size: [roomSize, wallThickness, roomSize],
          position: [0, 8, 0],
          rotation: [0, 0, 0],
        },
        // Back wall
        {
          size: [roomSize, 10, wallThickness],
          position: [0, 3, -roomSize / 2],
          rotation: [0, 0, 0],
        },
        // Front wall
        {
          size: [roomSize, 10, wallThickness],
          position: [0, 3, roomSize / 2],
          rotation: [0, 0, 0],
        },
        // Left wall
        {
          size: [wallThickness, 10, roomSize],
          position: [-roomSize / 2, 3, 0],
          rotation: [0, 0, 0],
        },
        // Right wall
        {
          size: [wallThickness, 10, roomSize],
          position: [roomSize / 2, 3, 0],
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
        scene.add(mesh)

        const shape = new Ammo.btBoxShape(
          new Ammo.btVector3(
            wall.size[0] / 2,
            wall.size[1] / 2,
            wall.size[2] / 2
          )
        )
        shape.setMargin(0.05)
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
        physicsWorld.addRigidBody(body)
      })

      const handleClick = (event) => {
        const rect = renderer.domElement.getBoundingClientRect()
        mouseRef.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1
        mouseRef.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1

        raycasterRef.current.setFromCamera(mouseRef.current, camera)
        const intersects = raycasterRef.current.intersectObjects(
          rigidBodiesRef.current.map((body) => body.mesh)
        )

        if (intersects.length > 0) {
          const clickedMesh = intersects[0].object
          const clickedBody = rigidBodiesRef.current.find(
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

      renderer.domElement.addEventListener('click', handleClick)

      const animate = () => {
        requestAnimationFrame(animate)
        controls.update()

        if (physicsWorldRef.current) {
          physicsWorldRef.current.stepSimulation(1 / 60, 10)

          rigidBodiesRef.current.forEach((body) => {
            const ms = body.motionState
            if (ms) {
              ms.getWorldTransform(transformAuxRef.current)
              const p = transformAuxRef.current.getOrigin()
              const q = transformAuxRef.current.getRotation()
              body.mesh.position.set(p.x(), p.y(), p.z())
              body.mesh.quaternion.set(q.x(), q.y(), q.z(), q.w())
            }
          })
        }

        renderer.render(scene, camera)
      }

      animate()

      const handleResize = () => {
        const width = mount.clientWidth
        const height = mount.clientHeight
        renderer.setSize(width, height)
        camera.aspect = width / height
        camera.updateProjectionMatrix()
      }

      window.addEventListener('resize', handleResize)

      return () => {
        window.removeEventListener('resize', handleResize)
        renderer.domElement.removeEventListener('click', handleClick)
        mount.removeChild(renderer.domElement)
      }
    }

    try {
      initScene()
    } catch (error) {
      console.error('Error initializing scene:', error)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    addPrimitive: (type) => {
      if (!sceneRef.current || !physicsWorldRef.current) return

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
      mesh.position.set(0, 2, 0)
      mesh.rotation.set(
        Math.random() * Math.PI,
        Math.random() * Math.PI,
        Math.random() * Math.PI
      )
      shape.setMargin(0.05)

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
      // Apply initial random velocity
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

      physicsWorldRef.current.addRigidBody(body)
      body.mesh = mesh
      body.motionState = motionState

      rigidBodiesRef.current.push(body)
      sceneRef.current.add(mesh)
    },
  }))

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
})

export default Scene
