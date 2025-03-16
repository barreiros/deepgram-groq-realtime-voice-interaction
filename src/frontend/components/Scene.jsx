import React, { useEffect, useRef, useImperativeHandle } from 'react'
import * as THREE from 'three'
import { Vector3 } from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

const Scene = React.forwardRef((props, ref) => {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)
  const meshesRef = useRef([])

  useEffect(() => {
    const mount = mountRef.current
    const width = mount.clientWidth
    const height = mount.clientHeight

    const scene = new THREE.Scene()
    sceneRef.current = scene

    const camera = new THREE.PerspectiveCamera(75, width / height, 0.1, 1000)
    camera.position.z = 5
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

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()

      meshesRef.current.forEach((mesh) => {
        const time = Date.now() * 0.001
        mesh.position.x = Math.sin(time * mesh.speed.x) * 2
        mesh.position.y = Math.cos(time * mesh.speed.y) * 2
        mesh.position.z = Math.sin(time * mesh.speed.z) * 2
        mesh.rotation.x += 0.01 * mesh.speed.x
        mesh.rotation.y += 0.01 * mesh.speed.y
      })

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
      mount.removeChild(renderer.domElement)
    }
  }, [])

  useImperativeHandle(ref, () => ({
    addPrimitive: (type) => {
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
        color: Math.random() * 0xffffff,
        shininess: 100,
      })
      const mesh = new THREE.Mesh(geometry, material)
      mesh.position.set(0, 0, 0)
      mesh.speed = new Vector3(
        Math.random() * 0.5 + 0.5,
        Math.random() * 0.5 + 0.5,
        Math.random() * 0.5 + 0.5
      )
      if (sceneRef.current) {
        sceneRef.current.add(mesh)
        meshesRef.current.push(mesh)
      }
    },
  }))

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
})

export default Scene
