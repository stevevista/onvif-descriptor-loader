// Copyright IBM Corp. 2016,2017. All Rights Reserved.
// Node module: strong-soap
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

/**
 * XML Schema Elements
 *
 * element --> @name|@ref|@type|@maxOccurs|@minOccurs|
 *             simpleType|complexType
 * simpleType --> @name|restriction
 * complexType --> @name|simpleContent|complexContent|
 *                 group|all|choice|sequence|
 *                 attribute|attributeGroup
 * simpleContent --> restriction|extension
 * complexContent --> restriction|extension
 * restriction -->
 *   simpleType: @base|minExclusive|minInclusive|maxExclusive|maxInclusive|
 *               totalDigits|fractionDigits|length|minLength|maxLength|
 *               enumeration|whiteSpace|pattern
 *   simpleContent: @base|minExclusive|minInclusive|maxExclusive|maxInclusive|
 *                  totalDigits|fractionDigits|length|minLength|maxLength|
 *                  enumeration|whiteSpace|pattern|
 *                  attribute|attributeGroup
 *   complexContent: @base|minExclusive|minInclusive|maxExclusive|maxInclusive|
 *                   totalDigits|fractionDigits|length|minLength|maxLength|
 *                   enumeration|whiteSpace|pattern|
 *                   group|all|choice|sequence|
 *                   attribute|attributeGroup
 * extension --> @base|group|all|choice|sequence|
 *               attribute|attributeGroup
 * group --> @name|@ref|all|choice|sequence
 * attribute --> @name|@ref|@default|@fixed|@type|@use
 * attributeGroup --> @name|@ref|attribute|attributeGroup
 * all --> @maxOccurs|@minOccurs|element
 * choice --> @maxOccurs|@minOccurs|element|group|choice|sequence|any
 * sequence --> @maxOccurs|@minOccurs|element|group|choice|sequence|any
 */

var helper = require('./helper');

var elementTypes = [
  './xsd/all',
  './xsd/annotation',
  './xsd/any',
  './xsd/anyAttribute',
  './xsd/attribute',
  './xsd/attributeGroup',
  './xsd/choice',
  './xsd/complexContent',
  './xsd/complexType',
  './xsd/documentation',
  './xsd/element',
  './xsd/unique',
  './xsd/key',
  './xsd/keyref',
  './xsd/extension',
  './xsd/group',
  './xsd/import',
  './xsd/include',
  './xsd/restriction',
  './xsd/sequence',
  './xsd/simpleContent',
  './xsd/simpleType',
  './xsd/list',
  './xsd/union',
  './xsd/schema',
  './wsdl/binding',
  './wsdl/definitions',
  './wsdl/fault',
  './wsdl/import',
  './wsdl/input',
  './wsdl/message',
  './wsdl/operation',
  './wsdl/output',
  './wsdl/part',
  './wsdl/portType',
  './wsdl/types',
  './wsdl/documentation',
  './soap12/body',
  './soap12/headerFault',
  './soap12/fault'
];

var registry;

function getRegistry() {
  if (registry) {
    return registry;
  }
  registry = {
    elementTypes: {},
    elementTypesByName: {}
  };
  elementTypes.forEach(function(t) {
    var type = require(t);
    registry.elementTypes['{' + type.targetNamespace + '}' + type.elementName] = type;
    registry.elementTypesByName[type.elementName] = type;
  });
  return registry;
}

function getElementType(qname) {
  var registry = getRegistry();
  var ElementType =
    registry.elementTypes['{' + qname.nsURI + '}' + qname.name];
  if (!ElementType) {
    let XSDElement = require('./xsd/xsdElement');
    let WSDLElement = require('./wsdl/wsdlElement');
    let SOAP12Element = require('./soap12/soapElement');
    const {HTMLElement} = require('./element-html');
    if (qname.nsURI === helper.namespaces.wsdl) {
      ElementType = WSDLElement;
    } else if (qname.nsURI === helper.namespaces.xsd) {
      ElementType = XSDElement;
    } else if (qname.nsURI === helper.namespaces.soap) {
      throw new Error('only soap 1.2 supported')
    } else if (qname.nsURI === helper.namespaces.soap12) {
      ElementType = SOAP12Element;
    } else {
      ElementType = HTMLElement;
    }
  }
  return ElementType;
}

exports.getRegistry = getRegistry;
exports.getElementType = getElementType;
