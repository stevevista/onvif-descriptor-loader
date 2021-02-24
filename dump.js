const {TypeDescriptor, ElementDescriptor, AttributeDescriptor} = require('./xsd/descriptor')

function mergeRefOriginal (type, stack) {
  if (stack.includes(type)) {
    return
  }

  stack.push(type)
  let typeDescriptor
  let htmldoc

  if (type.refOriginal) {
    htmldoc = type.refOriginal.htmldoc
    typeDescriptor = type.refOriginal.typeDescriptor
    delete type.refOriginal
  }

  if (type.elements) {
    for (const obj of type.elements) {
      mergeRefOriginal(obj, stack)
    }
  }

  if (type.attributes) {
    for (const obj of type.attributes) {
      mergeRefOriginal(obj, stack)
    }
  }

  if (typeDescriptor) {
    mergeRefOriginal(typeDescriptor, stack)
  }

  if (!type.htmldoc) type.htmldoc = htmldoc
  if (!type.typeDescriptor) type.typeDescriptor = typeDescriptor

  stack.pop()
}

function dumpDescriptors (methods) {
  for (const k in methods.operations) {
    mergeRefOriginal (methods.operations[k].input, [])
    mergeRefOriginal (methods.operations[k].output, [])
    if (methods.operations[k].faults) {
      for (const f in methods.operations[k].faults) {
        mergeRefOriginal (methods.operations[k].faults[f], [])
      }
    }
  }

  let objId = 1
  let result = JSON.stringify(methods, (key, value) => {
    if (key === 'jsType') {
      if (value === Number) {
        return ':Number:';
      } else if (value === String) {
        return ':String:';
      } else if (value === Boolean) {
        return ':Boolean:';
      } else if (value === Date) {
        return ':Date:';
      }
    }

    // default values
    if (key === 'isSimple' && value === false) {
      return
    }

    if (key === 'isMany' && value === false) {
      return
    }

    if (key === 'form' && value == 'qualified') {
      return
    }

    if (Array.prototype.isPrototypeOf(value) && value.length === 0) {
      return;
    }
  
    if (Object.prototype.isPrototypeOf(value) && Object.keys(value).length === 0) {
      return;
    }

    if (Array.prototype.isPrototypeOf(value)) {
      return [...value];
    }

    if (value instanceof AttributeDescriptor || value instanceof ElementDescriptor || value instanceof TypeDescriptor) {
      if (typeof value.__id === 'string') {
        return `${value.__id}`
      }

      let p
      if (value instanceof AttributeDescriptor) {
        p = ':a:'
      } else if (value instanceof ElementDescriptor) {
        p = ':e:'
      } else if (value instanceof TypeDescriptor) {
        p = ':t:'
      }

      value.__id = p + (objId++)
    }
    return value
  }, '\t');

  return result
}

module.exports = dumpDescriptors
