const riot = require('riot')
const loaderUtils = require('loader-utils')
const TAGS_NAMES_REGEX = /riot.tag2\(['|"](.+?)['|"],/g

/**
 * Generate the hmr code depending on the tags generated by the compiler
 * @param   { Array } tags - array of strings
 * @returns { String } the code needed to handle the riot hot reload
 */
function hotReload(tags) {
  return `
  if (module.hot) {
    module.hot.accept()
    if (module.hot.data) {
      ${ tags.map(tag => `riot.reload('${ tag }')`).join('\n') }
    }
  }`
}

/**
 * Compile using the riot compiler returning always an object with {map, code}
 * @param   { String } source - component source content
 * @param   { Object } opts   - compiler options
 * @param   { String } resourcePath - path to the component file
 * @returns { Object } result containing always the map and code keys
 */
function compile(source, opts, resourcePath) {
  const exec = () => riot.compile(source, opts, resourcePath)
  return opts.sourcemap ? exec() : { code: exec(), map: false }
}

module.exports = function(source) {
  // tags collection
  const tags = []

  // parse the user query
  const query = (typeof this.query === 'string' ?
    loaderUtils.parseQuery(this.query) :
    this.query
  )

  // normalise the query object in case of question marks
  const opts = Object.keys(query).reduce(function(acc, key) {
    acc[key.replace('?', '')] = query[key]
    return acc
  }, {})

  // compile and generate sourcemaps
  const {code, map} = compile(
    source,
    Object.assign(opts, { sourcemap: this.sourceMap }),
    this.resourcePath
  )

  // generate the output code
  const output = `
    var riot = require('riot')
    ${ code }
    ${ opts.hot ? hotReload(tags) : '' }
  `

  // detect the tags names
  code.replace(TAGS_NAMES_REGEX, function(_, match) {
    tags.push(match)
  })

  // cache this module
  if (this.cacheable) this.cacheable()

  // return code and sourcemap
  if (map) this.callback(null, output, map.toJSON())

  return output
}