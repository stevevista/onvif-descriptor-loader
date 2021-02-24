# onvif-descriptor-loader
load onvif wsdl descriptor as js object

# Example

```js
import restoreDescriptors from 'onvif-descriptor-loader/restore';
import devicemgmtObj from 'onvif-descriptor-loader!./specifications/devicemgmt.wsdl';

restoreDescriptors(devicemgmtObj.operations)

```
