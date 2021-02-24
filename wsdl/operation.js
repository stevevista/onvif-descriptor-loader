// Copyright IBM Corp. 2016,2018. All Rights Reserved.
// Node module: strong-soap
// This file is licensed under the MIT License.
// License text available at https://opensource.org/licenses/MIT

'use strict';

var WSDLElement = require('./wsdlElement');
var descriptor = require('../xsd/descriptor');
var ElementDescriptor = descriptor.ElementDescriptor;
var TypeDescriptor = descriptor.TypeDescriptor;
var QName = require('../qname');
var helper = require('../helper');

var assert = require('assert');

const Style = {
  documentLiteralWrapped: 'documentLiteralWrapped',
  documentLiteral: 'documentLiteral',
  rpcLiteral: 'rpcLiteral',
  rpcEncoded: 'rpcEncoded',
  documentEncoded: 'documentEncoded'
};

class Operation extends WSDLElement {
  constructor(nsName, attrs, options) {
    super(nsName, attrs, options);
    //there can be multiple faults defined in the operation. They all will have same type name 'fault'
    //what differentiates them from each other is, the element/s which will get added under fault <detail> during runtime.
    this.faults = [];
  }

  addChild(child) {
    switch (child.name) {
      case 'input':
        this.input = child;
        break;
      case 'output':
        this.output = child;
        break;
      case 'fault':
        this.faults.push(child);
        break;
      case 'operation': // soap:operation
        this.soapAction = child.$soapAction || '';
        this.style = child.$style || '';
        //figure out from the binding operation soap version 1.1 or 1.2
        if(child.nsURI !== 'http://schemas.xmlsoap.org/wsdl/soap12/') {
          throw new Error('only soap 1.2 supported')
        }
        break;
    }
  }

  postProcess(definitions) {
    try {
      if (this._processed) return; // Already processed
      if (this.input) this.input.postProcess(definitions);
      if (this.output) this.output.postProcess(definitions);
      for (let i = 0, n = this.faults.length; i < n; i++) {
        this.faults[i].postProcess(definitions);
      }
      if (this.parent.name === 'binding') {
        this.getMode();
      }
      this._processed = true;
    } catch (err) {
      throw err;
    }
  }

  describeFaults(definitions) {
    var faults = {};
    for (var f in this.faults) {
      let fault = this.faults[f];
      let part = fault.message && fault.message.children[0]; //find the part through Fault message. There is only one part in fault message
      if (part && part.element) {
        faults[f] = part.element.describe(definitions);
      } else {
        console.warn('{{WS-I}} violation: ' +
          '{{http://ws-i.org/profiles/basicprofile-1.2-2010-11-09.html#BP2113}}' +
          ' part %s', part.$name);
      }
    }
    return faults;
  }

  describe(definitions) {
    if (this.descriptor) return this.descriptor;

    var input, output;
    switch (this.mode) {
      case Style.documentLiteralWrapped:
        if (this.input && this.input.body) {
          for (let p in this.input.body.parts) {
            let wrapperElement = this.input.body.parts[p].element;
            if (wrapperElement) {
              input = wrapperElement.describe(definitions);
            }
            break;
          }
        }
        if (this.output && this.output.body) {
          for (let p in this.output.body.parts) {
            let wrapperElement = this.output.body.parts[p].element;
            if (wrapperElement) {
              output = wrapperElement.describe(definitions);
            }
            break;
          }
        }
        break;
      case Style.documentLiteral:
        input = new descriptor.TypeDescriptor();
        output = new descriptor.TypeDescriptor();
        if (this.input && this.input.body) {
          for (let p in this.input.body.parts) {
            let element = this.input.body.parts[p].element;
            if (element) {
              input.addElement(element.describe(definitions));
            }
          }
        }
        if (this.output && this.output.body) {
          for (let p in this.output.body.parts) {
            let element = this.output.body.parts[p].element;
            if (element) {
              output.addElement(element.describe(definitions));
            }
          }
        }
        break;
      case Style.rpcLiteral:
      case Style.rpcEncoded:
      case Style.documentEncoded:
        throw new Error(g.f('{{WSDL}} only document style supported'));
    }

    let faults = this.describeFaults(definitions);

    if (!this.soapAction) {
      throw new Error(`missing soapAction for operation '${this.$name}'`)
    }

    this.descriptor = {
      name: this.$name,
      style: this.mode,
      soapAction: this.soapAction,
      input,
      output,
      faults,
      htmldoc: this.htmldoc
    };

    return this.descriptor;
  }

  static createEnvelopeDescriptor(parameterDescriptor, isFault) {
    const prefix = 'soap';
    const nsURI = 'http://www.w3.org/2003/05/soap-envelope';
    var descriptor = new TypeDescriptor();

    var envelopeDescriptor = new ElementDescriptor(
      new QName(nsURI, 'Envelope', prefix), null, 'qualified', false);
    descriptor.add(envelopeDescriptor);

    var headerDescriptor = new ElementDescriptor(
      new QName(nsURI, 'Header', prefix), null, 'qualified', false);

    var bodyDescriptor = new ElementDescriptor(
      new QName(nsURI, 'Body', prefix), null, 'qualified', false);

    envelopeDescriptor.addElement(headerDescriptor);
    envelopeDescriptor.addElement(bodyDescriptor);

    //add only if input or output. Fault is list of faults unlike input/output element and fault needs further processing below,
    //before it can be added to the <body>
    if (parameterDescriptor && !isFault) {
      bodyDescriptor.add(parameterDescriptor);
    }

    //process faults. An example of resulting structure of the <Body> element with soap 1.1 <Fault> element descriptor:
    /*
     <soap:Body>
       <soap:Fault>
          <faultcode>sampleFaultCode</faultcode>
          <faultstring>sampleFaultString</faultstring>
          <detail>
            <ns1:myMethodFault1 xmlns:ns1="http://example.com/doc_literal_wrapped_test.wsdl">
              <errorMessage1>MyMethod Business Exception message</errorMessage1>
              <value1>10</value1>
            </ns1:myMethodFault1>
          </detail>
        </soap:Fault>
     </soap:Body>
     */
    if (isFault && parameterDescriptor) {
      let xsdStr = new QName(helper.namespaces.xsd, 'string', 'xsd');
      var form;
      form = 'qualified';

      let faultDescriptor = new ElementDescriptor(
        new QName(nsURI, 'Fault', prefix), null, 'qualified', false);
      bodyDescriptor.add(faultDescriptor);
      let detailDescriptor;
    
        let code = new ElementDescriptor(new QName(nsURI, 'Code', prefix));
        code.add(
          new ElementDescriptor(new QName(nsURI, 'Value', prefix), null, form, false));
        let subCode = new ElementDescriptor(new QName(nsURI, 'Subcode', prefix), null, form, false);
        code.add (subCode);
        subCode.add(
          new ElementDescriptor(new QName(nsURI, 'Value', prefix), null, form, false));
        faultDescriptor.add(code, null, form, false);
        let reason = new ElementDescriptor(new QName(nsURI, 'Reason', prefix));
        reason.add(
          new ElementDescriptor(new QName(nsURI, 'Text', prefix), null, form, false));
        faultDescriptor.add(reason, null, form, false);
        faultDescriptor.add(
          new ElementDescriptor(new QName(nsURI, 'Node', prefix), null, form, false));
        faultDescriptor.add(
          new ElementDescriptor(new QName(nsURI, 'Role', prefix), null, form, false));
        detailDescriptor =
          new ElementDescriptor(new QName(nsURI, 'Detail', prefix), null, form, false);
        faultDescriptor.add(detailDescriptor);

      //multiple faults may be defined in wsdl for this operation. Go though every Fault and add it under <detail> element.
      for (var f in parameterDescriptor) {
        detailDescriptor.add(parameterDescriptor[f]);
      }
    }

    return descriptor;
  }

  getMode() {
    let use = this.input && this.input.body && this.input.body.use || 'literal';
    if (this.style === 'document' && use === 'literal') {
      // document literal
      let element = null;
      let count = 0;
      if (this.input && this.input.body) {
        for (let p in this.input.body.parts) {
          let part = this.input.body.parts[p];
          element = part.element;
          if (!(part.element && !part.type)) {
            console.error('Document/literal part should use element', part);
            throw new Error('Document/literal part should use element');
          }
          count++;
        }
      }
      // Only one part and the input wrapper element has the same name as
      // operation
      if (count === 1 && element.$name === this.$name) {
        count = 0;
        if (this.output && this.output.body) {
          for (let p in this.output.body.parts) {
            let part = this.output.body.parts[p];
            element = part.element;
            assert(part.element && !part.type,
              'Document/literal part should use element');
            count++;
          }
        }
        if (count === 1) {
          this.mode = Style.documentLiteralWrapped;
        } else {
          this.mode = Style.documentLiteral;
        }
      } else {
        this.mode = Style.documentLiteral;
      }
    } else if (this.style === 'document' && use === 'encoded') {
      this.mode = Style.documentEncoded;
    } else if (this.style === 'rpc' && use === 'encoded') {
      this.mode = Style.rpcEncoded;
    } else if (this.style === 'rpc' && use === 'literal') {
      this.mode = Style.rpcLiteral;
    }
    return this.mode;
  }

}

Operation.Style = Style;
Operation.elementName = 'operation';
Operation.allowedChildren = ['documentation', 'input', 'output', 'fault',
  'operation'];

module.exports = Operation;

