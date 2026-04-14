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
  getDocFromServer,
  orderBy
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { FootwearItem, ProductionStatus, Material, ModelConsumption } from '../types';

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
    orderDate: number;
    deadline: number;
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
            orderDate: orderData.orderDate,
            deadline: orderData.deadline,
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

  async updateStatusById(id: string, status: ProductionStatus, operatorName?: string): Promise<boolean> {
    if (!db) return false;
    try {
      const docRef = doc(db, COLLECTION_NAME, id);
      const updateData: any = {
        status,
        updatedAt: Date.now(),
      };
      
      if (operatorName && status === 'Produzido') {
        updateData.producedBy = operatorName;
      } else if (status === 'Pendente') {
        updateData.producedBy = null;
      }

      await updateDoc(docRef, updateData);
      return true;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
      return false;
    }
  },

  async updateStatus(barcode: string, status: ProductionStatus, operatorName?: string): Promise<boolean> {
    if (!db) return false;
    try {
      const q = query(collection(db, COLLECTION_NAME), where('barcode', '==', barcode));
      const snapshot = await getDocs(q);
      
      if (!snapshot.empty) {
        const docRef = doc(db, COLLECTION_NAME, snapshot.docs[0].id);
        const updateData: any = {
          status,
          updatedAt: Date.now(),
        };
        
        if (operatorName && status === 'Produzido') {
          updateData.producedBy = operatorName;
        } else if (status === 'Pendente') {
          updateData.producedBy = null; // Clear operator if status is reset to pending
        }

        await updateDoc(docRef, updateData);
        return true;
      }
      return false;
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
      return false;
    }
  },

  async bulkUpdateStatus(itemsToUpdate: { id: string }[], status: ProductionStatus, operatorName: string): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      const timestamp = Date.now();
      
      itemsToUpdate.forEach(item => {
        const docRef = doc(db, COLLECTION_NAME, item.id);
        batch.update(docRef, {
          status,
          producedBy: operatorName,
          updatedAt: timestamp
        });
      });

      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, COLLECTION_NAME);
    }
  },

  async getOperators(): Promise<any[]> {
    if (!db) return [];
    try {
      const q = query(collection(db, 'operators'), orderBy('name', 'asc'));
      const snapshot = await getDocs(q);
      return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
      handleFirestoreError(error, OperationType.LIST, 'operators');
      return [];
    }
  },

  async addOperator(name: string): Promise<void> {
    if (!db) return;
    try {
      await addDoc(collection(db, 'operators'), {
        name,
        createdAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'operators');
    }
  },

  async deleteOperator(id: string): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'operators', id));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'operators');
    }
  },

  async createProgramming(name: string, description: string, orderNumbers: string[]): Promise<string> {
    if (!db) return '';
    try {
      const docRef = await addDoc(collection(db, 'programmings'), {
        name,
        description,
        orderNumbers,
        status: 'Ativa',
        createdAt: Date.now(),
        updatedAt: Date.now(),
      });

      // Update all items belonging to these orders with the new programmingId
      const batch = writeBatch(db);
      for (const orderNum of orderNumbers) {
        const q = query(collection(db, COLLECTION_NAME), where('orderNumber', '==', orderNum));
        const snapshot = await getDocs(q);
        snapshot.docs.forEach(d => {
          batch.update(d.ref, { programmingId: docRef.id });
        });
      }
      await batch.commit();

      return docRef.id;
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'programmings');
      return '';
    }
  },

  async deleteProgramming(id: string): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      
      // Clear programmingId from items
      const q = query(collection(db, COLLECTION_NAME), where('programmingId', '==', id));
      const snapshot = await getDocs(q);
      snapshot.docs.forEach(d => {
        batch.update(d.ref, { programmingId: null });
      });

      // Delete programming doc
      batch.delete(doc(db, 'programmings', id));
      
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'programmings');
    }
  },

  async addMaterial(name: string, unit: string): Promise<void> {
    if (!db) return;
    try {
      await addDoc(collection(db, 'materials'), {
        name,
        unit,
        createdAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'materials');
    }
  },

  async deleteMaterial(id: string): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'materials', id));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'materials');
    }
  },

  async addModelConsumption(modelName: string, materialId: string, consumptionPerPair: number, size?: string): Promise<void> {
    if (!db) return;
    try {
      await addDoc(collection(db, 'modelConsumptions'), {
        modelName,
        materialId,
        consumptionPerPair,
        size: size || null,
        createdAt: Date.now()
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'modelConsumptions');
    }
  },

  async deleteModelConsumption(id: string): Promise<void> {
    if (!db) return;
    try {
      const batch = writeBatch(db);
      batch.delete(doc(db, 'modelConsumptions', id));
      await batch.commit();
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'modelConsumptions');
    }
  }
};
