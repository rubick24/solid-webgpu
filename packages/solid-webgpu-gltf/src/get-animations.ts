import { untrack } from 'solid-js'
import { Quat, Vec3 } from 'solid-webgpu'
import type { Animation } from './generated/glTF'
import { getAccessor } from './get-accessor'
import type { LoaderContext } from './types'

export type AnimationPlayback = { stop: () => void; seek: (time: number) => void }
export type GLTFAnimation = {
  name: string
  duration: number
  play: (options?: { loop?: boolean; speed?: number }) => AnimationPlayback
}

export const getAnimations = (context: LoaderContext): GLTFAnimation[] =>
  (context.json.animations ?? []).map((animation: Animation, animationIndex) => {
    const channels = animation.channels.flatMap(channel => {
      const node = channel.target.node
      if (node === undefined) return []
      const path = channel.target.path
      if (!['translation', 'rotation', 'scale', 'weights'].includes(path)) return []
      const nodeWeights = path === 'weights' ? context.nodeWeights.get(node) : undefined
      if (path === 'weights' && !nodeWeights)
        throw new Error(`Animation ${animationIndex} targets weights on node ${node} without a morph mesh`)
      const sampler = animation.samplers[channel.sampler]
      if (!sampler) throw new Error(`Animation ${animationIndex} references a missing sampler`)
      const input = getAccessor(sampler.input, context).bufferData as Float32Array
      const outputAccessor = getAccessor(sampler.output, context)
      if (outputAccessor.componentType !== 5126 || outputAccessor.normalized) {
        throw new Error(`Animation ${animationIndex} output must use FLOAT components`)
      }
      const output = outputAccessor.bufferData as Float32Array
      if (input.length === 0) throw new Error(`Animation ${animationIndex} has no keyframes`)
      if (input.some((time, i) => !Number.isFinite(time) || (i > 0 && time <= input[i - 1]))) {
        throw new Error(`Animation ${animationIndex} keyframe times must be finite and strictly increasing`)
      }
      const interpolation = sampler.interpolation ?? 'LINEAR'
      if (!['STEP', 'LINEAR', 'CUBICSPLINE'].includes(interpolation)) {
        throw new Error(`Unsupported animation interpolation ${interpolation}`)
      }
      const size = path === 'rotation' ? 4 : path === 'weights' ? nodeWeights!.count : 3
      const expectedOutputCount = input.length * size * (interpolation === 'CUBICSPLINE' ? 3 : 1)
      if (output.length !== expectedOutputCount)
        throw new Error(`Animation ${animationIndex} output count does not match its channel`)
      return [{ node, path, times: input, output, size, interpolation }]
    })
    const duration = channels.reduce((max, channel) => Math.max(max, channel.times[channel.times.length - 1]), 0)

    // Animation writes local transforms imperatively. Rebuild the affected
    // world matrices parent-first, including descendants of animated nodes.
    const nodes = context.json.nodes ?? []
    const affectedNodes = new Set<number>()
    const includeChildren = (node: number) => {
      if (affectedNodes.has(node)) return
      affectedNodes.add(node)
      for (const child of nodes[node]?.children ?? []) includeChildren(child)
    }
    for (const channel of channels) {
      if (channel.path !== 'weights') includeChildren(channel.node)
    }

    const parents = new Map<number, number>()
    nodes.forEach((node, parent) => {
      for (const child of node.children ?? []) parents.set(child, parent)
    })
    const orderedNodes: number[] = []
    const visitedNodes = new Set<number>()
    const visitNode = (node: number) => {
      if (visitedNodes.has(node)) return
      visitedNodes.add(node)
      const parent = parents.get(node)
      if (parent !== undefined && affectedNodes.has(parent)) visitNode(parent)
      if (affectedNodes.has(node)) orderedNodes.push(node)
    }
    for (const node of affectedNodes) visitNode(node)

    const apply = (time: number) =>
      untrack(() => {
        const scenes = new Set<{ invalidate?: () => void }>()
        for (const channel of channels) {
          const { times, output, size, interpolation, node, path } = channel
          let next = 0
          while (next < times.length - 1 && times[next + 1] <= time) next++
          const previous = next
          const following = Math.min(previous + 1, times.length - 1)
          const span = times[following] - times[previous]
          const amount = span > 0 ? Math.max(0, Math.min(1, (time - times[previous]) / span)) : 0
          const values = new Float32Array(size)
          const outputOffset = (key: number, part: number) =>
            interpolation === 'CUBICSPLINE' ? (key * 3 + part) * size : key * size

          if (interpolation === 'CUBICSPLINE' && following !== previous) {
            const t2 = amount * amount
            const t3 = t2 * amount
            const h00 = 2 * t3 - 3 * t2 + 1
            const h10 = t3 - 2 * t2 + amount
            const h01 = -2 * t3 + 3 * t2
            const h11 = t3 - t2
            const a = outputOffset(previous, 1)
            const outTangent = outputOffset(previous, 2)
            const b = outputOffset(following, 1)
            const inTangent = outputOffset(following, 0)
            for (let i = 0; i < size; i++) {
              values[i] =
                h00 * output[a + i] +
                h10 * span * output[outTangent + i] +
                h01 * output[b + i] +
                h11 * span * output[inTangent + i]
            }
          } else {
            const a = outputOffset(previous, interpolation === 'CUBICSPLINE' ? 1 : 0)
            const b = outputOffset(following, interpolation === 'CUBICSPLINE' ? 1 : 0)
            if (interpolation === 'STEP' || following === previous) {
              values.set(output.subarray(a, a + size))
            } else if (path === 'rotation') {
              Quat.slerp(values, output.subarray(a, a + 4), output.subarray(b, b + 4), amount)
            } else {
              for (let i = 0; i < size; i++) values[i] = output[a + i] + (output[b + i] - output[a + i]) * amount
            }
          }

          if (path === 'weights') {
            const weights = context.nodeWeights.get(node)
            if (weights) weights.value.set(values)
            for (const ref of context.nodeRefs.get(node) ?? []) {
              const scene = ref.scene()?.[0]
              if (scene) scenes.add(scene)
            }
          } else if (path === 'rotation') {
            const rotation = new Quat(values)
            Quat.normalize(rotation, rotation)
            for (const ref of context.nodeRefs.get(node) ?? []) {
              Quat.copy(ref.quaternion(), rotation)
              const scene = ref.scene()?.[0]
              if (scene) scenes.add(scene)
            }
          } else {
            const vector = new Vec3(values)
            for (const ref of context.nodeRefs.get(node) ?? []) {
              if (path === 'translation') Vec3.copy(ref.position(), vector)
              else Vec3.copy(ref.scale(), vector)
              const scene = ref.scene()?.[0]
              if (scene) scenes.add(scene)
            }
          }
        }

        for (const node of orderedNodes) {
          for (const ref of context.nodeRefs.get(node) ?? []) {
            ref.updateMatrix()
            const scene = ref.scene()?.[0]
            if (scene) scenes.add(scene)
          }
        }
        for (const scene of scenes) scene.invalidate?.()
      })

    let frame = 0
    let startedAt = 0
    let stopped = true
    const seek = (time: number) => apply(Math.max(0, Math.min(duration, time)))
    const stop = () => {
      stopped = true
      cancelAnimationFrame(frame)
    }
    const play = ({ loop = true, speed = 1 }: { loop?: boolean; speed?: number } = {}): AnimationPlayback => {
      stop()
      stopped = false
      startedAt = performance.now()
      const tick = (now: number) => {
        if (stopped) return
        const elapsed = ((now - startedAt) / 1000) * speed
        if (!loop && elapsed >= duration) {
          seek(duration)
          stopped = true
          return
        }
        seek(duration ? elapsed % duration : 0)
        frame = requestAnimationFrame(tick)
      }
      frame = requestAnimationFrame(tick)
      return { stop, seek }
    }

    return { name: animation.name ?? `Animation ${animationIndex}`, duration, play }
  })
