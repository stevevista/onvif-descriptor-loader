const QName = require('./qname');
const {TypeDescriptor, ElementDescriptor, AttributeDescriptor} = require('./xsd/descriptor')

function restoreDescriptors (methods) {
  const references = {}
  resolveReferences(references, methods)

  for (const k in methods) {
    restoreOperationDescriptor(methods[k])
  }
}

function resolveReferences (references, obj) {
  if (Array.prototype.isPrototypeOf(obj)) {
    for (let k = 0; k < obj.length; k++) {
      const ref = resolveReferences(references, obj[k])
      if (ref) {
        obj[k] = ref
      }
    }
  } else if (Object.prototype.isPrototypeOf(obj)) {
    let Type

    if (typeof obj.__id === 'string') {
      references[obj.__id] = obj

      if (obj.qname) {
        Object.setPrototypeOf(obj.qname, QName.prototype)
      }

      if (obj.__id.startsWith(':a:')) {
        Type = AttributeDescriptor
        obj.form = obj.form || 'qualified'
      } else {
        if (obj.elements === undefined) {
          obj.elements = []
        }
        if (obj.attributes === undefined) {
          obj.attributes = []
        }

        if (obj.__id.startsWith(':e:')) {
          Type = ElementDescriptor
          obj.isSimple = !!obj.isSimple
          obj.isMany = !!obj.isMany
          obj.form = obj.form || 'qualified'
        } else {
          Type = TypeDescriptor
        }
      }

      delete obj.__id
    }

    // resolve children first
    for (const k in obj) {
      const ref = resolveReferences(references, obj[k])
      if (ref) {
        obj[k] = ref
      }
    }
    // resolve prototype
    if (Type !== undefined) {
      Object.setPrototypeOf(obj, Type.prototype)
    }
  } else if (typeof obj === 'string') {
    if (obj === ':Number:') {
      return Number;
    } else if (obj === ':String:') {
      return String;
    } else if (obj === ':Boolean:') {
      return Boolean;
    } else if (obj === ':Date:') {
      return Date;
    } else if (obj.startsWith(':a:') || obj.startsWith(':e:') || obj.startsWith(':t:')) {
      const ref = references[obj]
      if (!ref) {
        throw new Error(`cannot resolve ${obj}`)
      }
      return ref
    }
  }
}

function restoreOperationDescriptor (descriptor) {
  if (!descriptor.output) {
    descriptor.output = new TypeDescriptor()
  }
  if (!descriptor.faults) {
    descriptor.faults = []
  }

  descriptor.inputEnvelope =
    createEnvelopeDescriptor(descriptor.input, false);
  descriptor.outputEnvelope =
    createEnvelopeDescriptor(descriptor.output, false);
  descriptor.faultEnvelope =
    createEnvelopeDescriptor(descriptor.faults, true);
}

function createEnvelopeDescriptor (parameterDescriptor, isFault) {
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

  // add only if input or output. Fault is list of faults unlike input/output element and fault needs further processing below,
  // before it can be added to the <body>
  if (parameterDescriptor && !isFault) {
    bodyDescriptor.add(parameterDescriptor);
  }

  // process faults. An example of resulting structure of the <Body> element with soap 1.1 <Fault> element descriptor:
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
    code.add(subCode);
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

    // multiple faults may be defined in wsdl for this operation. Go though every Fault and add it under <detail> element.
    for (var f in parameterDescriptor) {
      detailDescriptor.add(parameterDescriptor[f]);
    }
  }

  return descriptor;
}

module.exports = restoreDescriptors;
