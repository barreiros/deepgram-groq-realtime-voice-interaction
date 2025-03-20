import * as Ammo from 'ammo.js'

export class PhysicsEngine {
  constructor() {
    this.rigidBodies = []
    this.initPhysics()
  }

  initPhysics() {
    try {
      const collisionConfiguration = new Ammo.btDefaultCollisionConfiguration()
      const dispatcher = new Ammo.btCollisionDispatcher(collisionConfiguration)
      const broadphase = new Ammo.btDbvtBroadphase()
      const solver = new Ammo.btSequentialImpulseConstraintSolver()
      this.physicsWorld = new Ammo.btDiscreteDynamicsWorld(
        dispatcher,
        broadphase,
        solver,
        collisionConfiguration
      )
      this.physicsWorld.setGravity(new Ammo.btVector3(0, -9.8, 0))
      this.transformAux = new Ammo.btTransform()
    } catch (error) {
      console.error('Error initializing Ammo.js physics:', error)
      throw error
    }
  }

  createRigidBody(mesh, shape, mass = 1, position = { x: 0, y: 0, z: 0 }) {
    if (shape.setMargin) {
      shape.setMargin(0.05)
    }

    const transform = new Ammo.btTransform()
    transform.setIdentity()
    transform.setOrigin(new Ammo.btVector3(position.x, position.y, position.z))

    const motionState = new Ammo.btDefaultMotionState(transform)
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

    this.physicsWorld.addRigidBody(body)
    body.mesh = mesh
    body.motionState = motionState

    this.rigidBodies.push(body)
    return body
  }

  applyImpulse(body, force, worldPoint) {
    const ammoForce = new Ammo.btVector3(force.x, force.y, force.z)
    const ammoPoint = new Ammo.btVector3(
      worldPoint.x,
      worldPoint.y,
      worldPoint.z
    )
    body.applyImpulse(ammoForce, ammoPoint)
  }

  setGravity(x, y, z) {
    this.physicsWorld.setGravity(new Ammo.btVector3(x, y, z))
  }

  update() {
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
}
