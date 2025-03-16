import React, { useEffect, useRef, useState } from 'react'
import { ThreeScene } from '../services/three/ThreeScene'

// Create a single instance of ThreeScene that can be reused
let threeSceneInstance = null

const Scene = ({ onSceneReady }) => {
  const mountRef = useRef(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    console.log('Scene mounted')

    // Error boundary
    try {
      if (mountRef.current) {
        // Only create a new instance if one doesn't exist
        if (!threeSceneInstance) {
          console.log('Creating new ThreeScene instance')
          threeSceneInstance = new ThreeScene(mountRef.current)
        } else {
          console.log('Reusing existing ThreeScene instance')
        }

        if (onSceneReady) {
          console.log('Setting sceneAPI with addPrimitive function')
          const api = {
            addPrimitive: (type) => {
              console.log('addPrimitive called from API with type:', type)
              if (threeSceneInstance) {
                threeSceneInstance.addPrimitive(type)
              } else {
                console.error(
                  'ThreeScene instance is null when trying to add primitive'
                )
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

    // No cleanup in the main component - we want to keep the ThreeScene instance alive
    // We'll only clean up when the app unmounts
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
