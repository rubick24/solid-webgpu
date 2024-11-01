declare const _EXAMPLES: [string, string][]

const examples = _EXAMPLES
const ul = document.createElement('ul')
examples.forEach(v => {
  const [name, filePath] = v
  const a = document.createElement('a')
  a.target = '_blank'
  a.href = `//${location.host}/examples/${name}/`
  a.innerText = `${name} (${filePath})`
  const li = document.createElement('li')
  li.appendChild(a)
  ul.appendChild(li)
})

document.body.appendChild(ul)
