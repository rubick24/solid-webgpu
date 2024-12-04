declare const _EXAMPLES: [string, string][]

const examples = _EXAMPLES
const ul = document.createElement('ul')

const folder = import.meta.env.MODE === 'production' ? 'example' : 'src'
examples.forEach(v => {
  const [name] = v
  const a = document.createElement('a')
  a.href = `./${folder}/${name}/`
  a.innerText = `${name}`
  const li = document.createElement('li')
  li.appendChild(a)
  ul.appendChild(li)
})

document.body.appendChild(ul)
