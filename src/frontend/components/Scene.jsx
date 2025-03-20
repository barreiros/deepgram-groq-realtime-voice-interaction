import React, { useEffect, useRef, useState } from 'react'
import { ThreeScene } from '../services/three/ThreeScene'
import { ProximityScene } from '../services/three/ProximityScene'

// Create instances that can be reused
let threeSceneInstance = null
let proximitySceneInstance = null

const Scene = ({ onSceneReady }) => {
  const mountRef = useRef(null)
  const [error, setError] = useState(null)
  const [activeScene, setActiveScene] = useState('physics')

  const changeScene = (sceneName) => {
    // Clean up current scene
    if (mountRef.current.querySelector('canvas')) {
      mountRef.current.querySelector('canvas').remove()
    }

    setActiveScene(sceneName)
  }

  useEffect(() => {
    try {
      if (mountRef.current) {
        let currentInstance = null

        // Initialize or use the appropriate scene based on activeScene
        if (activeScene === 'physics') {
          if (!threeSceneInstance) {
            threeSceneInstance = new ThreeScene(mountRef.current)
          } else {
            // Re-initialize if canvas was removed
            if (!mountRef.current.querySelector('canvas')) {
              threeSceneInstance.init()
            }
          }
          currentInstance = threeSceneInstance
        } else if (activeScene === 'proximity') {
          if (!proximitySceneInstance) {
            proximitySceneInstance = new ProximityScene(mountRef.current)
          } else {
            // Re-initialize if canvas was removed
            if (!mountRef.current.querySelector('canvas')) {
              proximitySceneInstance.init()
            }
          }
          currentInstance = proximitySceneInstance
        }

        if (onSceneReady && currentInstance) {
          const api = {
            addPrimitive: (type, color) => {
              console.log(
                'addPrimitive called from API with type:',
                type,
                'color:',
                color
              )
              if (currentInstance) {
                currentInstance.addPrimitive(type, color)
              } else {
                console.error(
                  'Scene instance is null when trying to add primitive'
                )
              }
            },
            rotateRoom: (axis, angle) => {
              if (currentInstance) {
                currentInstance.rotateRoom(axis, angle)
              }
            },
          }
          onSceneReady(api)
        }
      }
    } catch (err) {
      console.error('Error in Scene component:', err)
      setError(err)
    }

    const handleKeyDown = (event) => {
      let currentInstance =
        activeScene === 'physics' ? threeSceneInstance : proximitySceneInstance
      if (!currentInstance) return

      const rotationAngle = 0.1
      switch (event.key) {
        case 'ArrowLeft':
          currentInstance.rotateRoom('y', rotationAngle)
          break
        case 'ArrowRight':
          currentInstance.rotateRoom('y', -rotationAngle)
          break
        case 'ArrowUp':
          currentInstance.rotateRoom('x', rotationAngle)
          break
        case 'ArrowDown':
          currentInstance.rotateRoom('x', -rotationAngle)
          break
        case 'q':
          currentInstance.rotateRoom('z', rotationAngle)
          break
        case 'e':
          currentInstance.rotateRoom('z', -rotationAngle)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSceneReady, activeScene])

  // Error state
  if (error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        Error initializing 3D scene: {error.message}
      </div>
    )
  }

  const addRandomPrimitive = () => {
    const primitiveTypes = ['cube', 'sphere', 'cone', 'torus']
    const randomType =
      primitiveTypes[Math.floor(Math.random() * primitiveTypes.length)]

    const colors = [0xff0000, 0x00ff00, 0x0000ff, 0xffff00, 0xff00ff, 0x00ffff]
    const randomColor = colors[Math.floor(Math.random() * colors.length)]

    let currentInstance =
      activeScene === 'physics' ? threeSceneInstance : proximitySceneInstance
    if (currentInstance) {
      currentInstance.addPrimitive(randomType, randomColor)
    }
  }

  return (
    <div style={{ position: 'relative', width: '100%', height: '100vh' }}>
      <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
      <div
        style={{
          position: 'absolute',
          top: '20px',
          right: '20px',
          display: 'flex',
          flexDirection: 'column',
          gap: '10px',
        }}
      >
        <select
          value={activeScene}
          onChange={(e) => changeScene(e.target.value)}
          style={{
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '1px solid #444',
          }}
        >
          <option value="physics">Physics Scene</option>
          <option value="proximity">Proximity Scene</option>
        </select>

        <button
          onClick={addRandomPrimitive}
          style={{
            padding: '8px',
            borderRadius: '4px',
            backgroundColor: 'rgba(0, 0, 0, 0.7)',
            color: 'white',
            border: '1px solid #444',
            cursor: 'pointer',
          }}
        >
          Add Random Shape
        </button>
      </div>
    </div>
  )
}

export default Scene
