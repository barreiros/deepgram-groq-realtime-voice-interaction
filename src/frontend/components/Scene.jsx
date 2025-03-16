import React, { useEffect, useRef } from 'react'
import * as THREE from 'three'
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls'

export default function Scene() {
  const mountRef = useRef(null)
  const sceneRef = useRef(null)
  const cameraRef = useRef(null)
  const rendererRef = useRef(null)
  const controlsRef = useRef(null)

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

    const addRandomPrimitive = () => {
      const primitives = [
        () => new THREE.BoxGeometry(1, 1, 1),
        () => new THREE.SphereGeometry(0.5, 32, 32),
        () => new THREE.ConeGeometry(0.5, 1, 32),
        () => new THREE.TorusGeometry(0.5, 0.2, 16, 100),
      ]

      const randomGeometry =
        primitives[Math.floor(Math.random() * primitives.length)]()
      const material = new THREE.MeshPhongMaterial({
        color: Math.random() * 0xffffff,
        shininess: 100,
      })
      const mesh = new THREE.Mesh(randomGeometry, material)

      mesh.position.set(
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10,
        (Math.random() - 0.5) * 10
      )

      mesh.rotation.set(
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2,
        Math.random() * Math.PI * 2
      )

      scene.add(mesh)
    }

    window.addRandomPrimitive = addRandomPrimitive

    const animate = () => {
      requestAnimationFrame(animate)
      controls.update()
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

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}
