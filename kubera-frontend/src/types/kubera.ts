// import { Idl } from '@project-serum/anchor';

// export interface IDL extends Idl {
//   address: string;
//   metadata: {
//     name: string;
//     version: string;
//     spec: string;
//     description: string;
//   };
//   // You may need to add more specific type definitions here
//   // based on your program's structure
// }

import { IDL } from '../utils/kubera_idl';

export type Kubera = typeof IDL;