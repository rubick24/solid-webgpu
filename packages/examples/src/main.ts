declare const _EXAMPLES: [string, string][]

const examples = _EXAMPLES
const ul = document.createElement('ul')
examples.forEach(v => {
  const [name] = v
  const a = document.createElement('a')
  a.href = `//${location.host}/src/${name}/`
  a.innerText = `${name}`
  const li = document.createElement('li')
  li.appendChild(a)
  ul.appendChild(li)
})

document.body.appendChild(ul)
