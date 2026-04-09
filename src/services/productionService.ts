import { 
  collection, 
  addDoc, 
  getDocs, 
  updateDoc, 
  query, 
  where, 
  doc, 
  serverTimestamp,
  writeBatch,
  getDocFromServer
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FootwearItem, ProductionStatus } from '../types';

const COLLECTION_NAME = 'productionItems';

enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
}

function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// Test connection on boot
async function testConnection() {
  if (!db) return;
  try {
    await getDocFromServer(doc(db, 'test', 'connection'));
  } catch (error) {
    if(error instanceof Error && error.message.includes('the client is offline')) {
      console.error("Please check your Firebase configuration. ");
    }
  }
}
testConnection();

export const productionService = {
  async getItems(): Promise<FootwearItem[]> {
    if (!db) return [];
    try {
      const q = collection(db, COLLECTION_NAME);
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as FootwearItem));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, COLLECTION_NAME);
      return [];
    }
  },

  async createOrder(orderData: {
    orderNumber: string;
    model: string;
    color: string;
    sizeQuantities: { size: string; quantity: number }[];
    pairsPerLabel: number;
  }): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      const colRef = collection(db, COLLECTION_NAME);

      orderData.sizeQuantities.forEach(sq => {
        let remaining = sq.quantity;
        let batchNum = 1;

        while (remaining > 0) {
          const currentBatchQty = Math.min(remaining, orderData.pairsPerLabel);
          const newDocRef = doc(colRef);
          const barcode = `${orderData.orderNumber}-${orderData.model.substring(0, 2).toUpperCase()}-${orderData.color.substring(0, 2).toUpperCase()}-${sq.size}-L${batchNum}-${currentBatchQty}`;
          
          batch.set(newDocRef, {
            orderNumber: orderData.orderNumber,
            model: orderData.model,
            color: orderData.color,
            size: sq.size,
            quantity: currentBatchQty,
            barcode,
            status: 'Pendente',
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });

          remaining -= currentBatchQty;
          batchNum++;
        }
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, COLLECTION_NAME);
    }
  },

  async deleteOrder(orderNumber: string): Promise<void> {
    if (!db) return;
    try {
      const q = query(collection(db, COLLECTION_NAME), where('orderNumber', '==', orderNumber));
      const snapshot = await getDocs(q);
      
      const batch = writeBatch(db);
      snapshot.docs.forEach((doc) => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, COLLECTION_NAME);
    }
  },

  async updateStatus(barcode: string, status: ProductionStatus): Promise<boolean> {
    if (!db) return false;
    try {
      const q = query(collection(db, COLLECTION_NAME), where('barcode', '==', barcode));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
        await updateDoc(docRef, {
          status,
          updatedAt: Date.now(),
        });
        return true;
      }
      return false;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
      return false;
    }
  }
};
