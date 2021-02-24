// Copyright IBM Corp. 2016,2019. All Rights Reserved.
// Node module: strong-soap
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';
const path = require('path');
const fs = require('fs');
const sax = require('sax');
const assert = require('assert');
const debug = require('debug')('strong-soap:wsdl');
const _ = require('lodash');

const QName = require('./qname');
const Definitions = require('./wsdl/definitions');
const Types = require('./wsdl/types');
const Schema = require('./xsd/schema');
const {HTMLTextElement} = require('./element-html');

async function _parseWSDL (uri, options) {
  const basename = path.basename(uri);
  let diskpath = path.join(options.wsdlLocation || '', basename);

  const content = await fs.promises.readFile(diskpath, {encoding: 'utf8'})

  return _parse(content, options);
}

// return: Definitions | {Schema}
async function _loadWSDL (uri, options) {
  const definitions = await _parseWSDL(uri, options)

  if (!(definitions instanceof Definitions)) {
    throw new Error(`${uri} is not documentation wsdl`)
  }

  const {schemas} = definitions;
  let includes = [];

  for (var ns in schemas) {
    const schema = schemas[ns];
    includes = includes.concat(schema.includes || []);
  }

  for (const include of includes) {
    const wsdl = await _loadWSDL(include.location, options)
      
    // Set namespace for included schema that does not have targetNamespace
    if (undefined in wsdl.schemas) {
      if (include.namespace != null) {
        // If A includes B and B includes C, B & C can both have no targetNamespace
        wsdl.schemas[include.namespace] = wsdl.schemas[undefined];
        delete wsdl.schemas[undefined];
      }
    }

    _.mergeWith(definitions, wsdl, function (a, b) {
      if (a === b) {
        return a;
      }
      return (a instanceof Schema) ? a.merge(b, include.type === 'include') : undefined;
    });
  }

  definitions.postProcess();

  // for document style, for every binding, prepare input message
  // element name to (methodName, output message element name) mapping
  for (const bindingName in definitions.bindings) {
    const binding = definitions.bindings[bindingName];
    if (binding.style == null) {
      binding.style = 'document';
    }
  }

  return definitions
}

// @return Definitions
function _parse (xml, options) {
  const p = sax.parser(true, {trim: true})
  let stack = [],
    root = null,
    types = null,
    schema = null,
    text = '';

  p.onopentag = function(node) {
    debug('Start element: %j', node);
    var top = stack[stack.length - 1];
  
    if (text.length && top) {
      // emulating onopentag/onclosetag
      let child = new HTMLTextElement(text);
      child.parent = top
      top.children.push(child);
    }
    text = ''; // reset text
    var nsName = node.name;
    var attrs = node.attributes;
    
    var name;
    if (top) {
      top.startElement(stack, nsName, attrs, options);
    } else {
      name = QName.parse(nsName).name;
      if (name === 'definitions') {
        root = new Definitions(nsName, attrs, options);
        stack.push(root);
      } else if (name === 'schema') {
        // Shim a structure in here to allow the proper objects to be
        // created when merging back.
        // Shim a structure in here to allow the proper objects to be
        // created when merging back.
        root = new Definitions('wsdl:definitions', {}, {});
        types = new Types('wsdl:types', {}, {});
        schema = new Schema(nsName, attrs, options);
        types.addChild(schema);
        root.addChild(types);
        stack.push(schema);
      } else {
        throw new Error(g.f('Unexpected root element of {{WSDL}} or include'));
      }
    }
  };

  p.onclosetag = function(name) {
    debug('End element: %s', name);
    var top = stack[stack.length - 1];
    assert(top, 'Unmatched close tag: ' + name);

    if (text) {
      let child = new HTMLTextElement(text);
      child.parent = top
      top.children.push(child);
      text = '';
    }
    top.endElement(stack, name);
  };

  p.ontext = function(str) {
    text = text + str;
  }

  p.write(xml).close();

  return root;
}

async function openWSDL (uri, options = {}) {
  const definitions = await _loadWSDL(uri, options);
  if (!(definitions instanceof Definitions)) {
    throw new Error(`${uri} is not documentation wsdl`)
  }

  return definitions
}

async function loadDescriptors (uri, options = {}) {
  const definitions = await openWSDL(uri, options)

  const {schemas} = definitions
  
  for (const uri in schemas) {
      const {complexTypes} = schemas[uri];
      for (let type in complexTypes) {
        complexTypes[type].describe(definitions);
      }
  }

  for (const uri in schemas) {
      const {complexTypes} = schemas[uri];
      for (let type in complexTypes) {
        complexTypes[type].describeChildren(definitions);
      }
  }

  const operations = {}
  for (const name in definitions.bindings) {
    _defineBinding(operations, definitions, definitions.bindings[name]);
  }

  return {xmlns: definitions.xmlns, operations};
}

function _defineBinding (descs, definitions, binding) {
  for (const name in binding.operations) {
    descs[name] = _defineOperation(definitions, binding.operations[name]);
  }
}

function _defineOperation (definitions, operation) {
  //console.log(this.nsContext)
  var operationDescriptor = operation.describe(definitions);
  return operationDescriptor;
}

module.exports = loadDescriptors;
