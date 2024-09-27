const examples = ['base', 'gltf']

const ul = document.createElement('ul')
const links = examples.forEach(v => {
  const a = document.createElement('a')
  a.target = '_blank'
  a.href = `//${location.host}/examples/${v}/`
  a.innerText = v
  const li = document.createElement('li')
  li.appendChild(a)
  ul.appendChild(li)
})

document.body.appendChild(ul)
