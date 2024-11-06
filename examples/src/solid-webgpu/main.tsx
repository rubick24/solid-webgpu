import { Object3D } from 'core'
import { Vec3 } from 'math'
import { render } from 'solid-webgpu'

const Box = () => {
  return <mesh position={Vec3.fromValues(1, 2, 3)} />
}

const App = () => {
  return (
    <mesh />
    // <>
    //   <Box />
    //   <mesh />
    //   <mesh />
    // </>
  )
}

const scene = new Object3D()
render(() => <App />, scene)

console.log(scene)
