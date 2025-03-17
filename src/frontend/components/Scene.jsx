import React, { useEffect, useRef, useState } from 'react'
import { ThreeScene } from '../services/three/ThreeScene'

// Create a single instance of ThreeScene that can be reused
let threeSceneInstance = null

const Scene = ({ onSceneReady }) => {
  const mountRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    try {
      if (mountRef.current) {
        // Only create a new instance if one doesn't exist
        if (!threeSceneInstance) {
          threeSceneInstance = new ThreeScene(mountRef.current)
        }

        if (onSceneReady) {
          const api = {
            addPrimitive: (type, color) => {
              console.log(
                'addPrimitive called from API with type:',
                type,
                'color:',
                color
              )
              if (threeSceneInstance) {
                threeSceneInstance.addPrimitive(type, color)
              } else {
                console.error(
                  'ThreeScene instance is null when trying to add primitive'
                )
              }
            },
            rotateRoom: (axis, angle) => {
              if (threeSceneInstance) {
                threeSceneInstance.rotateRoom(axis, angle)
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
      if (!threeSceneInstance) return

      const rotationAngle = 0.1
      switch (event.key) {
        case 'ArrowLeft':
          threeSceneInstance.rotateRoom('y', rotationAngle)
          break
        case 'ArrowRight':
          threeSceneInstance.rotateRoom('y', -rotationAngle)
          break
        case 'ArrowUp':
          threeSceneInstance.rotateRoom('x', rotationAngle)
          break
        case 'ArrowDown':
          threeSceneInstance.rotateRoom('x', -rotationAngle)
          break
        case 'q':
          threeSceneInstance.rotateRoom('z', rotationAngle)
          break
        case 'e':
          threeSceneInstance.rotateRoom('z', -rotationAngle)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
    }
  }, [onSceneReady])

  // Error state
  if (error) {
    return (
      <div style={{ color: 'red', padding: '20px' }}>
        Error initializing 3D scene: {error.message}
      </div>
    )
  }

  return <div ref={mountRef} style={{ width: '100%', height: '100vh' }} />
}

export default Scene
