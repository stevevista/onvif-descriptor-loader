const loadDescriptors = require('./load')
const dumpDescriptors = require('./dump')
const path = require('path')

module.exports = async function (source, map) {
  var loader = this;
  var filename = loader.resourcePath;

  const wsdlLocation = path.dirname(filename);
  const basename = path.basename(filename);

  const wsdl = await loadDescriptors(basename, {wsdlLocation})
  const result = dumpDescriptors(wsdl)
  // const fs = require('fs')
  // fs.writeFileSync('E:\\dev\\cvt_' + path.basename(filename) + '.json', result)
  return 'module.exports = ' + result + ';';
};
