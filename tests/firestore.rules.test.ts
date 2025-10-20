// @ts-nocheck
import { initializeTestEnvironment, RulesTestEnvironment, assertFails, assertSucceeds } from '@firebase/rules-unit-testing'
import { readFileSync } from 'fs'
import { setLogLevel, doc, getDoc, setDoc, getFirestore, collection, addDoc } from 'firebase/firestore'

let testEnv: RulesTestEnvironment

beforeAll(async () => {
  setLogLevel('error')
  testEnv = await initializeTestEnvironment({
    projectId: 'demo-santashelper',
    firestore: {
      rules: readFileSync('FIRESTORE_RULES.txt', 'utf8'),
    },
  })
})

afterAll(async () => {
  await testEnv.clearFirestore()
  await testEnv.cleanup()
})

describe('Families access', () => {
  test('Parent can read/write settings and parentData', async () => {
    const ctx = testEnv.authenticatedContext('parent-1', { role: 'parent' })
    const db = ctx.firestore()
    await assertSucceeds(setDoc(doc(db, 'families/f1/settings'), { parentPinHash: 'hash' }))
    await assertSucceeds(getDoc(doc(db, 'families/f1/settings')))
    await assertSucceeds(setDoc(doc(db, 'families/f1/parentData/secret'), { a: 1 }))
    await assertSucceeds(getDoc(doc(db, 'families/f1/parentData/secret')))
  })

  test('Non-parent denied on settings and parentData', async () => {
    const ctx = testEnv.authenticatedContext('child-1', { role: 'child' })
    const db = ctx.firestore()
    await assertFails(setDoc(doc(db, 'families/f1/settings'), { parentPinHash: 'hash' }))
    await assertFails(getDoc(doc(db, 'families/f1/settings')))
    await assertFails(setDoc(doc(db, 'families/f1/parentData/secret'), { a: 1 }))
    await assertFails(getDoc(doc(db, 'families/f1/parentData/secret')))
  })

  test('Parent can read unset settings doc (seeded)', async () => {
    const adminDb = testEnv.unauthenticatedContext().firestore()
    await setDoc(doc(adminDb, 'families/fseed/settings'), { pinStatus: 'unset' })
    const ctx = testEnv.authenticatedContext('fseed', { role: 'parent' })
    const db = ctx.firestore()
    await assertSucceeds(getDoc(doc(db, 'families/fseed/settings')))
  })

  test('Parent cannot change parentPinHash once set (Firestorm rule)', async () => {
    const adminDb = testEnv.unauthenticatedContext().firestore()
    await setDoc(doc(adminDb, 'families/f2/settings'), { parentPinHash: 'hash', pinStatus: 'set' })
    const ctx = testEnv.authenticatedContext('f2', { role: 'parent' })
    const db = ctx.firestore()
    // Attempt to overwrite should fail per rules
    await assertFails(setDoc(doc(db, 'families/f2/settings'), { parentPinHash: 'newhash' }, { merge: true }))
    // Updating unrelated fields should succeed
    await assertSucceeds(setDoc(doc(db, 'families/f2/settings'), { theme: 'dark' }, { merge: true }))
  })
})

describe('Users role immutability by clients', () => {
  test('User can read own doc', async () => {
    const ctx = testEnv.authenticatedContext('u1', { role: 'parent' })
    const db = ctx.firestore()
    // Seed via admin
    const adminDb = testEnv.unauthenticatedContext().firestore()
    await setDoc(doc(adminDb, 'users/u1'), { name: 'Alice', role: 'child' })

    await assertSucceeds(getDoc(doc(db, 'users/u1')))
  })

  test('Parent cannot modify role field directly', async () => {
    const ctx = testEnv.authenticatedContext('u2', { role: 'parent' })
    const db = ctx.firestore()
    const adminDb = testEnv.unauthenticatedContext().firestore()
    await setDoc(doc(adminDb, 'users/u2'), { name: 'Bob', role: 'child' })

    await assertFails(setDoc(doc(db, 'users/u2'), { role: 'parent' }, { merge: true }))
  })

  test('Admin claim can update role field (mirroring)', async () => {
    const ctx = testEnv.authenticatedContext('u3', { admin: true })
    const db = ctx.firestore()
    const adminDb = testEnv.unauthenticatedContext().firestore()
    await setDoc(doc(adminDb, 'users/u3'), { name: 'Cara', role: 'child' })

    await assertSucceeds(setDoc(doc(db, 'users/u3'), { role: 'parent' }, { merge: true }))
  })
})
