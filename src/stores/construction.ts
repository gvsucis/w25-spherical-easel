import {
  ConstructionInFirestore,
  SphericalConstruction,
  ConstructionScript,
  PublicConstructionInFirestore,
  StarredConstruction
} from "@/types";
import { Command } from "@/commands/Command";
import { defineStore } from "pinia";
import { Auth, getAuth } from "firebase/auth";
import { ref, Ref } from "vue";
import {
  FirebaseStorage,
  deleteObject,
  getDownloadURL,
  getStorage,
  ref as storageRef,
  uploadString
} from "firebase/storage";
import {
  getDocs,
  getDoc,
  updateDoc,
  doc,
  collection,
  QuerySnapshot,
  QueryDocumentSnapshot,
  getFirestore,
  Firestore,
  deleteDoc,
  deleteField,
  addDoc,
  DocumentReference,
  DocumentSnapshot,
  increment
} from "firebase/firestore";
import "@/extensions/array-extensions";
import axios, { AxiosResponse } from "axios";
import { Matrix4 } from "three";
import { storeToRefs } from "pinia";
import { useAccountStore } from "@/stores/account";
import { useSEStore } from "./se";
import { watch } from "vue";
import { mergeIntoImageUrl } from "@/utils/helpingfunctions";
import { watchDebounced, watchPausable } from "@vueuse/core";
import EventBus from "@/eventHandlers/EventBus";
import { i } from "vite/dist/node/types.d-aGj9QkWt";

let appStorage: FirebaseStorage;
let appDB: Firestore;
let appAuth: Auth;

/**
 * attempt to parse the script from a firestore construction; the script being
 * a list of commands to execute in-order to re-generate the construction.
 *
 * @param id the non-public id of the construction being parsed
 * @param remoteDoc construction in firestore to attempt parsing the script field from
 * @returns promise of a spherical construction object that may be empty if the function
 *          cannot find and/or parse the data from firebase
 */
async function parseDocument(
  id: string,
  remoteDoc: ConstructionInFirestore
): Promise<SphericalConstruction> {
  /*
   * Download and parse the construction script from firebase
   */
  let parsedScript: ConstructionScript | undefined = undefined;
  // get the script without any trailing/leading whitespace
  const trimmedScript = remoteDoc.script.trim();
  if (trimmedScript.startsWith("https")) {
    // if the script looks like a URL, try to download it and then parse it.
    // if we can't, consider the script to be invalid and return an empty object.
    const scriptText = await getDownloadURL(
      storageRef(appStorage, trimmedScript)
    )
      .then((url: string) => axios.get(url))
      .then((r: AxiosResponse) => r.data)
      .catch((err: any) => {
        console.debug(
          "Firebase Storage error in fetching construction script",
          err
        );
        return [];
      });

    // cast the script's text into the parsedScript type
    parsedScript = scriptText as ConstructionScript;
    // if the script is not a URL and is not empty, assume it is JSON
  } else if (trimmedScript.length > 0) {
    // Parse the script directly from the Firestore document
    parsedScript = JSON.parse(trimmedScript) as ConstructionScript;
  }

  /*
   * Download and parse the preview script from firebase
   */
  let svgData: string | undefined;
  // if the script looks like a URL, try to download and parse it,
  // returning an empty string on failure.
  if (remoteDoc.preview?.startsWith("https:")) {
    svgData = await getDownloadURL(storageRef(appStorage, remoteDoc.preview))
      .then((url: string) => axios.get(url))
      .then((r: AxiosResponse) => r.data)
      .catch((err: any) => {
        console.debug("Firebase Storage error in fetching SVG preview", err);
        return "";
      });
  } else {
    // if the script does not look like a URL, use it as-is
    svgData = remoteDoc.preview;
  }

  /*
   * determine the number of commands in the script we just downloaded;
   * if we can't, consider the script to be invalid and set it to an empty object
   */
  let objectCount = 0;
  if (Array.isArray(parsedScript) && parsedScript.length > 0) {
    objectCount = parsedScript
      // A simple command contributes 1 object
      // A CommandGroup contributes N objects (as many elements in its subcommands)
      .map((z: string | Array<string>) =>
        typeof z === "string" ? 1 : z.length
      )
      .reduce(
        (prev: number, curr: number) => prev + curr,
        /* initial value */ 0
      );
  } else parsedScript = [];

  const sphereRotationMatrix = new Matrix4();
  if (remoteDoc.rotationMatrix) {
    // if we successfully downloaded the rotation matrix from the remote document,
    // parse it into three.js's Matrix4 type.
    const matrixData = JSON.parse(remoteDoc.rotationMatrix);
    sphereRotationMatrix.fromArray(matrixData);
  }

  // return a full non-databse SphericalConstruction object.
  return Promise.resolve({
    version: remoteDoc.version,
    id,
    script: trimmedScript,
    parsedScript,
    objectCount,
    author: remoteDoc.author, //static value assigned for new UI starred count
    dateCreated: remoteDoc.dateCreated,
    description: remoteDoc.description,
    // use the remote's aspect ratio if it has one, otherwise default to 1.
    aspectRatio: remoteDoc.aspectRatio ?? 1,
    sphereRotationMatrix,
    // use the parsed svg preview from firebase if valid, otherwise give no preview
    preview: svgData ?? "",
    publicDocId: remoteDoc.publicDocId,
    // use the parsed tools from firebase if valid, otherwise leave them undefined.
    tools: remoteDoc.tools ?? undefined,
    starCount: remoteDoc.starCount,
    path: remoteDoc.path ?? undefined
  } as SphericalConstruction);
}

/**
 * sort an array of constructions alphabetically by their IDs
 *
 * @param arr array to sort
 */
function sortConstructionArray(arr: Array<SphericalConstruction>) {
  arr.sort((a, b) => a.id.localeCompare(b.id));
}

/**
 * TreeviewNode representation with helper classes
 */
class TreeviewNode {
  public id: string;
  public title: string;
  public leaf: boolean;
  public children?: Array<TreeviewNode>;

  constructor(id: string, name: string, leaf?: boolean) {
    this.id = id;
    this.title = name;
    this.leaf = leaf ?? false;
  }

  public getPathParentNode(path: string): TreeviewNode {
    return this._getPathParentNode(path);
  }

  /**
   * this function is private as opposed to the public interface lacking the second argument to ensure
   * it is always called correctly by external consumers of its API
   *
   * @param path path to ensure exists and then return reference to; follows format
   *             'folder0/folder1/folderN/'
   * @param fullpath do not explicitly define this; it is only meant to be used by recursive calls.
   */
  private _getPathParentNode(path: string, fullpath?: string): TreeviewNode {
    /* ensure fullpath is defined, as it won't be at the root */
    fullpath = fullpath ?? this.id + "/" + path;
    /* find the first slash */
    const firstSlashIndex: number = path.indexOf("/");
    if (firstSlashIndex >= 0) {
      /* if the first slash exists, split the string into the current path and the remaining path */
      const curPath: string = path.slice(0, firstSlashIndex);
      const remainingPath: string = path.slice(firstSlashIndex + 1);

      /* use the path up to this point as a unique ID since duplicate paths can't exist - note that
       * this may still cause problems if the same paths exist in private and starred constructions since
       * this function is unaware of the name of root node. */
      var fullPathChunk: string = fullpath;
      if (remainingPath.length > 0) {
        fullPathChunk = fullPathChunk.replace("/" + remainingPath, "");
        if (fullPathChunk.at(-1) != "/") {
          fullPathChunk += "/";
        }
      }

      if (!this.children) {
        /* if this node does not have a children array, give it one and add the folder to it */
        this.children = Array<TreeviewNode>();
        this.children.push(new TreeviewNode(fullPathChunk, curPath));
        /* recurse */
        return this.children[0]._getPathParentNode(remainingPath, fullpath);
      } else {
        const childNode = this.children.find(node => node.id === fullPathChunk);
        /* if the child node exists, recurse on it */
        if (childNode) {
          return childNode._getPathParentNode(remainingPath, fullpath);
        } else {
          /* if the child node does not exist, create it and then recurse on it */
          this.children.push(new TreeviewNode(fullPathChunk, curPath));
          return this.children
            .at(-1)!
            ._getPathParentNode(remainingPath, fullpath);
        }
      }
    } else {
      /* if there is no first slash, assume we are at the right place in the hierarchy for this node */
      /* ensure this node has allocated an array for children */
      this.children = this.children ?? Array<TreeviewNode>();
      /* return a reference to this node */
      return this;
    }
  }

  /**
   * add a child node to this one based on its path. Assumes the node being called is the root node in the path.
   *
   * @param child      SphericalConstruction to append
   * @param parentNode parent node to insert at; if unknown, leave blank to automatically determine.
   */
  public appendChildConstruction(
    child: SphericalConstruction,
    parentNode?: TreeviewNode
  ) {
    /* determine the path at which the child is supposed to exist */
    const path = child.path ?? "";

    parentNode = parentNode ?? this.getPathParentNode(path);
    parentNode.children!.push(
      new TreeviewNode(child.id, child.description, true)
    );
  }

  /**
   * append a TreeviewNode as a child to this node
   *
   * @param child TreeviewNode to append
   */
  public appendChildNode(child: TreeviewNode) {
    /* since nodes don't have a concept of path on their own, just append as a child
    to the callee node */
    this.children = this.children ?? Array<TreeviewNode>();
    this.children.push(child);
  }
}

class ConstructionTree {
  /** the root node of our tree */
  private root: TreeviewNode;

  /** index of the public constructions in the root node's children */
  private readonly publicIdx = 0;
  /** index of the owned constructions in the root node's children */
  private readonly ownedIdx = 1;
  /** index of the starred constructions in the root node's children */
  private readonly starredIdx = 2;

  public constructor(root_title: string) {
    this.root = new TreeviewNode("root", root_title, false);

    /* ensure root has space for 3 children allocated for the public/owned/starred constructions */
    this.root.children = Array<TreeviewNode>(3);
    this.root.children[this.publicIdx] = new TreeviewNode(
      "Public Constructions",
      "Public Constructions",
      false
    );
    this.root.children[this.ownedIdx] = new TreeviewNode(
      "Owned Constructions",
      "Owned Constructions",
      false
    );
    this.root.children[this.starredIdx] = new TreeviewNode(
      "Starred Constructions",
      "Starred Constructions",
      false
    );
  }

  /**
   * clear any existing constructions and build the tree based on the
   * given lists of public, owned, and starred constructions.
   *
   * @param publicConstructions
   * @param ownedConstructions
   * @param starredConstructions
   */
  public fromArrays(
    publicConstructions: Ref<Array<SphericalConstruction>>,
    ownedConstructions: Ref<Array<SphericalConstruction>>,
    starredConstructions: Ref<Array<SphericalConstruction>>
  ) {
    this.clear();
    this.addPublicConstructions(...publicConstructions.value);
    this.addOwnedConstructions(...ownedConstructions.value);
    this.addStarredConstructions(...starredConstructions.value);

    // if a member has a zero-length array, delete it so that it doesn't appear to have elements
    // in the UI view
    [this.publicIdx, this.ownedIdx, this.starredIdx].forEach(idx => {
      if (this.root.children![idx].children?.length == 0) {
        this.root.children![idx].children = undefined;
      }
    });
  }

  /** append one or more constructions to the public construction subtree */
  public addPublicConstructions(...constructions: SphericalConstruction[]) {
    /* speed this up by finding the parent node once and then putting all constructions
     * beneath it; this mostly just ensures that we have an existing children array as desired
     * and avoids running the check multiple times */
    const parentNode = this.root.children![this.publicIdx].getPathParentNode(
      constructions[0].path ?? ""
    );

    constructions.forEach(x => {
      parentNode.appendChildConstruction(x, parentNode);
    });
  }

  /** append one or more construction to the owned constructions subtree */
  public addOwnedConstructions(...constructions: SphericalConstruction[]) {
    constructions.forEach(construction => {
      this.root.children![this.ownedIdx].appendChildConstruction(construction);
    });
  }

  /** append one or more constructions to the starred constructions subtree */
  public addStarredConstructions(...constructions: SphericalConstruction[]) {
    constructions.forEach(construction => {
      this.root.children![this.starredIdx].appendChildConstruction(
        construction
      );
    });
  }

  /**
   * @returns an array containing the root node of the tree structure
   */
  public getRootAsArr(): TreeviewNode[] {
    /*
     * I don't like this function since it returns a mutable reference to the private root element
     * this class maintains, but it's not worth it to make a deep copy every time and it is necessary for
     * the root to be accessible outside of this class since the treeview component needs to use it.
     */
    return [this.root];
  }

  /**
   * clear the construction tree, leaving only the 3 subtrees.
   */
  private clear() {
    this.root.children!.forEach(x => {
      x.children?.clear();
    });
  }
}

// define and export a store for constructions of all types
export const useConstructionStore = defineStore("construction", () => {
  const allPublicConstructions: Array<SphericalConstruction> = [];
  const publicConstructions: Ref<Array<SphericalConstruction>> = ref([]);
  const privateConstructions: Ref<Array<SphericalConstruction>> = ref([]);
  // Public constructions is never null
  const starredConstructions: Ref<Array<SphericalConstruction>> = ref([]);
  const constructionTree: ConstructionTree = new ConstructionTree(
    "constructions"
  );
  const currentConstructionPreview: Ref<string | null> = ref(null);
  const acctStore = useAccountStore();
  const seStore = useSEStore();
  const {
    svgCanvas,
    inverseTotalRotationMatrix,
    isEarthMode,
    canvasWidth,
    canvasHeight
  } = storeToRefs(seStore);
  const { firebaseUid, starredConstructionIDs, userEmail, includedTools } =
    storeToRefs(acctStore);
  let currentUID: string | undefined = undefined;
  let publicParsed: boolean = false;

  // watch for changes in the firebase collection
  watchDebounced(
    firebaseUid,
    async uid => {
      // console.debug("Firebase UID watcher", uid);
      if (uid) {
        await parseOwnedCollection(uid, privateConstructions.value);
        // Identify published owned constructions
        const myPublicSet: Set<string> = new Set();
        privateConstructions.value.forEach(s => {
          if (s.publicDocId) myPublicSet.add(s.publicDocId);
        });

        // Partition private list into mine and theirs
        const [theirs, _mine] = allPublicConstructions.partition(s => {
          const myOwnPublic = myPublicSet.has(s.publicDocId!);
          const inMyStarList = starredConstructionIDs.value.some(
            star => star === s.publicDocId
          );
          return !myOwnPublic && !inMyStarList;
        });
        publicConstructions.value = theirs;

        // update the constructions tree
        constructionTree.fromArrays(
          publicConstructions,
          privateConstructions,
          starredConstructions
        );
      } else {
        privateConstructions.value.splice(0);
        publicConstructions.value = allPublicConstructions.slice(0);
      }
    },
    { debounce: 500 /* milliseconds */ }
  );

  /* watch for updates in the private constructions list and ensure they are applied to
   * the tree view */
  watchDebounced(
    privateConstructions,
    async _ => {
      constructionTree.fromArrays(
        publicConstructions,
        privateConstructions,
        starredConstructions
      );
    },
    { debounce: 500 /* milliseconds */ }
  );

  // watch for changes in starred constructions
  watch(
    () => starredConstructionIDs.value,
    async favorites => {
      console.debug("Starred watcher", favorites);
      parseStarredConstructions(favorites);
    },
    { deep: true }
  );

  /**
   * Save a construction to a new ID, or overwrite an existing construction.
   *
   * @param constructionDocId ID of the construction doc to save to; if non-null, attempts
   *                          to overwrite an existing construction. If null, creates a new one.
   * @param constructionDescription description of the construction
   * @param saveAsPublic whether or not to also make an entry in the public constructions list for this construction
   * @returns the document ID of the saved construction
   */
  async function saveConstruction(
    constructionDocId: null | string,
    constructionDescription: string,
    saveAsPublic: boolean
  ): Promise<string> {
    /* create and dump to string an SVG of the construction */
    let svgBlock = "";
    const nonScalingOptions = {
      stroke: false,
      text: false,
      pointRadius: false,
      scaleFactor: 1
    };
    const animateOptions = undefined;
    svgBlock = Command.dumpSVG(
      Math.min(canvasWidth.value, canvasHeight.value),
      nonScalingOptions,
      animateOptions
    );
    let svgBlob = new Blob([svgBlock], { type: "image/svg+xml;charset=utf-8" });

    /* TODO: move the following constant to global-settings? */
    const FIELD_SIZE_LIMIT = 50 * 1024; /* in bytes */
    // A local function to convert a blob to base64 representation
    const toBase64 = (inputBlob: Blob): Promise<string> =>
      new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = reject;
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.readAsDataURL(inputBlob);
      });

    /* dump the command history */
    const scriptOut = Command.dumpOpcode();

    // TODO: should we decouple the zoomFactor from the rotation matrix when
    // saving a construction?. Possible issue: the construction
    // was saved by a user working on a larger screen (large zoomFactor),
    // but loaded by a user working on a smaller screen (small zoomFactor)

    const rotationMat = inverseTotalRotationMatrix.value;
    const userUid = appAuth.currentUser!.uid;
    // All constructions, regardless of private/public, are saved under the each user
    // subcollection. If a construction is made available to public, another document under
    // the top-level construction will be created
    const collectionPath = `users/${userUid}/constructions`;

    const svgDataUrl = await toBase64(svgBlob);
    let previewData: string;

    if (isEarthMode.value) {
      // In earth mode, the preview has to capture both the
      // the earth ThreeJS and the unit sphere TwoJS layers
      // Our trick below is to draw both layers (in the correct order)
      // into an offline canvas and then convert to a data image
      const earthCanvas = document.getElementById("earth") as HTMLCanvasElement;
      previewData = await mergeIntoImageUrl(
        // Must be specified in the correct order, the first item
        // in the array will be drawn to the offline canvas first
        [earthCanvas.toDataURL(), svgDataUrl],
        canvasWidth.value,
        canvasHeight.value,
        "png"
      );
      // FileSaver.saveAs(previewData, "hans.png");
    } else {
      previewData = svgDataUrl;
    }

    /* Create a pipeline of Firebase tasks
         Task 1: Upload construction to Firestore
         Task 2: Upload the script to Firebase Storage (for large script)
         Task 3: Upload the SVG preview to Firebase Storage (for large SVG)
      */
    let saveTask: Promise<DocumentReference>;
    const constructionDetails: ConstructionInFirestore = {
      version: "1",
      dateCreated: new Date().toISOString(),
      author: userEmail.value!,
      description: constructionDescription,
      rotationMatrix: JSON.stringify(rotationMat.elements),
      tools: includedTools.value,
      aspectRatio: canvasWidth.value / canvasHeight.value,
      // Use an empty string (for type checking only)
      // the actual script will be determine below
      script: "",
      preview: "",
      // TODO: check this may have to be grabbed from the existing doc in #1a
      starCount: 0
    };

    // Task #1
    if (constructionDocId !== null) {
      const targetDoc = doc(
        appDB,
        collectionPath.concat("/" + constructionDocId)
      );
      // Task #1a: update the existing construction
      getDoc(targetDoc).then(ds => {
        if (ds.exists()) {
          constructionDetails.starCount = ds.data().starCount;
        }
      });
      saveTask = updateDoc(targetDoc, constructionDetails as any).then(
        () => targetDoc
      );
    } else {
      // Task #1b: save as a new construction
      saveTask = addDoc(collection(appDB, collectionPath), constructionDetails);
    }

    // try {
    return await saveTask
      .then((constructionDoc: DocumentReference) => {
        acctStore.constructionDocId = constructionDoc.id;
        /* Task #2 */
        const scriptPromise: Promise<string> =
          scriptOut.length < FIELD_SIZE_LIMIT
            ? Promise.resolve(scriptOut)
            : uploadString(
                storageRef(appStorage, `scripts/${constructionDoc.id}`),
                scriptOut
              ).then(t => getDownloadURL(t.ref));

        /* Task #3 */
        const svgPromise: Promise<string> =
          previewData.length < FIELD_SIZE_LIMIT
            ? Promise.resolve(previewData)
            : uploadString(
                storageRef(
                  appStorage,
                  `construction-svg/${constructionDoc.id}`
                ),
                previewData
              ).then(t => getDownloadURL(t.ref));

        /* Wrap the result from the three tasks as a new Promise */
        return Promise.all([constructionDoc.id, scriptPromise, svgPromise]);
      })
      .then(async ([docId, scriptData, svgData]) => {
        const constructionDoc = doc(appDB, collectionPath, docId);
        // Pass on the document ID to be included in the alert message
        const parsedScript = JSON.parse(scriptData) as ConstructionScript;
        const objectCount = parsedScript.flatMap(s =>
          Array.isArray(s) ? s : [s]
        ).length;
        const localCopy: SphericalConstruction = {
          id: docId,
          parsedScript,
          sphereRotationMatrix: rotationMat.clone(),
          objectCount,
          ...constructionDetails
        };
        if (saveAsPublic) {
          const publicConstructionDoc = await addDoc(
            collection(appDB, "/constructions/"),
            {
              author: userUid,
              constructionDocId: docId // construction document under the user sub-collection
            }
          );
          await updateDoc(constructionDoc, {
            script: scriptData,
            preview: svgData,
            publicDocId: publicConstructionDoc.id
          });
          privateConstructions.value.push({
            ...localCopy,
            publicDocId: publicConstructionDoc.id
          });
        } else {
          await updateDoc(constructionDoc, {
            script: scriptData,
            preview: svgData
          });
          privateConstructions.value.push(localCopy);
        }
        return docId;
      });
    // } catch (err) {
    //   return err as Error
    // }
  }

  /**
   * Load a public construction by its ID
   *
   * @param docId docID of the public construction to load
   * @returns the resolved full construction as an object, or null if it cannot be loaded.
   */
  async function loadPublicConstruction(
    docId: string
  ): Promise<ConstructionScript | null> {
    return await getDoc(doc(appDB, "constructions", docId))
      .then((ds: DocumentSnapshot) => {
        const { author, constructionDocId } =
          ds.data() as PublicConstructionInFirestore;
        return getDoc(
          doc(appDB, "users", author, "constructions", constructionDocId)
        );
      })
      .then(async (ds: DocumentSnapshot) => {
        if (ds.exists()) {
          const { script } = ds.data() as ConstructionInFirestore;
          // Check whether the script is inline or stored in Firebase storage
          if (script.startsWith("https:")) {
            // The script must be fetched from Firebase storage
            const constructionStorage = storageRef(appStorage, script);
            const scriptText = await getDownloadURL(constructionStorage)
              .then((url: string) => axios.get(url))
              .then((r: AxiosResponse) => r.data);
            return JSON.parse(scriptText) as ConstructionScript;
          } else {
            // The script is inline
            return JSON.parse(script) as ConstructionScript;
          }
        } else {
          return null;
        }
      });
  }

  /**
   * fill an array with publically visible constructions
   *
   * @param targetArr array to fill with the publically visible constructions
   * @return nothing - the passed array is directly modified.
   */
  async function parsePublicCollection(
    targetArr: Array<SphericalConstruction>
  ): Promise<void> {
    targetArr.splice(0);
    /* get a snapshot of the current public constructions */
    const qs: QuerySnapshot = await getDocs(collection(appDB, "constructions"));

    /*
      build a list of every public construction, follow their pointers to the
      full constructions they refer to, and convert that list of public constructions
      into a list of full constructions that we can push into the consumer-provided
      array object.
     */
    const parseTasks: Array<Promise<SphericalConstruction>> = qs.docs.map(
      async (qd: QueryDocumentSnapshot) => {
        /* get and parse each public construction object */
        const remoteData = qd.data();
        const constructionRef = remoteData as PublicConstructionInFirestore;
        /* get a reference to the actual construction the public construction points to */
        const ownedDocRef = doc(
          appDB,
          "users",
          constructionRef.author,
          "constructions",
          constructionRef.constructionDocId
        );
        const ownedDoc = await getDoc(ownedDocRef);
        /* parse the actual construction into a construction type */
        return parseDocument(
          constructionRef.constructionDocId,
          ownedDoc.data() as ConstructionInFirestore
        );
      }
    );

    /* wait for all of the constructions to be fully parsed */
    const constructionArr: Array<SphericalConstruction> = await Promise.all(
      parseTasks
    );
    /* add the parsed constructions to the input list given by the user */
    targetArr.push(...constructionArr);

    if (!publicParsed) {
      parseStarredConstructions(starredConstructionIDs.value);
      publicParsed = true;
    }
  }

  /**
   * fill an array with a list of constructions owned by a given user
   *
   * @param owner firebase id of the user whose constructions are being queried
   * @param targetArr array to fill with owned constructions
   */
  async function parseOwnedCollection(
    owner: string,
    targetArr: Array<SphericalConstruction>
  ): Promise<void> {
    /* get a snapshot of the owner's constructions list */
    const qs: QuerySnapshot = await getDocs(
      collection(appDB, "users", owner, "constructions")
    );

    /* convert the firebase objects into construction types */
    const parseTask: Array<Promise<SphericalConstruction>> = qs.docs.map(
      (qd: QueryDocumentSnapshot) => {
        const remoteData = qd.data();
        return parseDocument(qd.id, remoteData as ConstructionInFirestore);
      }
    );

    /* wait for all of the constructions to be downloaded and parsed */
    const constructionArray: Array<SphericalConstruction> = await Promise.all(
      parseTask
    );
    /* clear the existing targetArr list */
    targetArr.splice(0);
    /*
      push the newly parsed and downloaded constructions into the array
    */
    targetArr.push(
      ...constructionArray.filter(
        (s: SphericalConstruction) => s.parsedScript.length > 0
      )
    );
  }

  /**
   * parse the starred and unstarred constructions from the firebase collection into arrays
   *
   * @param fromArr array of firebase public construction IDs to parse
   */
  async function parseStarredConstructions(fromArr: string[]) {
    if (fromArr.length > 0 && publicParsed) {
      console.debug("List of favorite items", fromArr);
      /* parse fromArr into a combination of ID and path */
      const stars: Array<StarredConstruction> = [];
      fromArr.forEach(x => {
        const splitIdx = x.indexOf("/");
        stars.push({
          id: splitIdx != -1 ? x.slice(0, splitIdx) : x,
          path: splitIdx != -1 ? x.slice(splitIdx + 1) : ""
        } as StarredConstruction);
      });

      console.debug("parsed stars: " + JSON.stringify(stars));

      /*
       * build list of starred and unstarred constructions, setting the path of the starred constructions
       * to that of the star item rather than the constructions's owned path.
       */
      var starred: Array<SphericalConstruction> = [];
      var unstarred: Array<SphericalConstruction> = [];
      allPublicConstructions.forEach(s => {
        const matchingStar = stars.find(star => star.id === s.publicDocId);
        if (matchingStar != undefined) {
          s.path = matchingStar.path;
          starred.push(s);
        } else {
          unstarred.push(s);
        }
      });
      starredConstructions.value = starred;
      publicConstructions.value = unstarred;

      /* if the starred length is not as expected, filter the stars to only include existing
         constructions and upload the cleaned list to firebase */
      if (starred.length !== stars.length) {
        EventBus.fire("show-alert", {
          type: "info",
          key: "Some of your starred constructions are not available anymore"
        });
        /* filter the stars list to only those that reference an existing public construction,
           then convert to an array of strings based on the id/path combination of the StarredConstruction object */
        const cleanStarred: Array<string> = stars
          .filter(star =>
            allPublicConstructions.some(z => star.id === z.publicDocId)
          )
          .map(x => x.id + (x.path.length > 0 ? "/" + x.path : ""));

        await updateStarredArrayInFirebase(cleanStarred);
      }
    } else {
      publicConstructions.value = allPublicConstructions;
    }
  }

  async function initialize() {
    // This function is invoked from App.vue
    appDB = getFirestore();
    appStorage = getStorage();
    appAuth = getAuth();

    await parsePublicCollection(allPublicConstructions);
    sortConstructionArray(allPublicConstructions);
    await parseStarredConstructions(starredConstructionIDs.value);
    publicConstructions.value = allPublicConstructions.slice(0);
    /* only update tree view if UID exists since it isn't displayed otherwise */
    if (firebaseUid) {
      constructionTree.fromArrays(
        publicConstructions,
        privateConstructions,
        starredConstructions
      );
    }
  }

  /**
   * delete a construction and its associated data from the firebase database
   * and the internal store.
   *
   * @param uid user ID of the user who owns the construction
   * @param docId document ID of the construction to delete
   *
   * @returns true if the deletion is successful, false otherwise
   */
  async function deleteConstruction(
    uid: string,
    docId: string
  ): Promise<boolean> {
    // get the index of the construciton in the list of constructions
    const pos = privateConstructions.value.findIndex(
      (c: SphericalConstruction) => c.id === docId
    );
    // only continue if we actually managed to find the construction in question;
    // if we can't find it, return false to indicate failure.
    if (pos < 0) return false;
    // grab a copy of the construction
    const victimDetails = privateConstructions.value[pos];
    // delete the public construction object for this construction if it
    // exists
    if (victimDetails.publicDocId) {
      try {
        await deleteDoc(doc(appDB, "constructions", victimDetails.publicDocId));
      } catch (err: any) {
        console.debug(
          "Unable to delete public construction",
          victimDetails.publicDocId
        );
      }
    }
    // delete the construction's script if it exists as a seperate storage blob
    if (victimDetails.script.startsWith("https://")) {
      try {
        await deleteObject(storageRef(appStorage, `/scripts/${docId}`));
      } catch (err: any) {
        console.debug(`Unable to delete script ${docId} in Firebase storage`);
      }
    }
    // delete the construction's preview if it exists as a seperate storage blob
    if (victimDetails.preview.startsWith("https://"))
      try {
        await deleteObject(
          storageRef(appStorage, `/construction-svg/${docId}`)
        );
      } catch (err: any) {
        console.debug(
          `Unable to delete SVG preview ${docId} in Firebase storage`
        );
      }
    // delete the database's copy of the construction
    await deleteDoc(doc(appDB, "users", uid, "constructions", docId));
    // remove the construction from the internal cache of constructions
    privateConstructions.value.splice(pos, 1);
    // return true to indicate success
    return true;
  }

  /**
   * make an owned construction private.
   *
   * @param docId firebase ID of the owned construction to make private
   *
   * @returns true on success, false on failure.
   */
  async function makePrivate(docId: string): Promise<boolean> {
    // find the index of the construction referenced by docId
    const pos = privateConstructions.value.findIndex(s => s.id === docId);
    // did we find the construction?
    if (pos >= 0) {
      // yes, we found the construction; get a reference to the owned construction
      // in firebase
      const ownedDocRef = doc(
        appDB,
        "users",
        firebaseUid.value!,
        "constructions",
        docId
      );
      // get the doc ID of the public construction that references this owned construction
      const publicDoc = privateConstructions.value[pos].publicDocId!;
      // get a reference to the public construction in firebase
      const publicDocRef = doc(appDB, "constructions", publicDoc);
      // delete the public doc ID in the owned construction
      await updateDoc(ownedDocRef, { publicDocId: deleteField() });
      // delete the public construction in firebase
      await deleteDoc(publicDocRef);
      // remove the public doc ID in the local store
      privateConstructions.value[pos].publicDocId = undefined;
      // return true to indicate success
      return true;
    } else {
      // no, we did not find the construction; return false to indicate failure.
      return false;
    }
  }

  /**
   * Make an owned construction public
   *
   * @param docId firebase ID of the owned construction to make public
   *
   * @returns true on success, false on failure
   */
  async function makePublic(docId: string): Promise<boolean> {
    // get the index of the requested construction in the store
    const pos = privateConstructions.value.findIndex(s => s.id === docId);
    // is the requested construction in the store?
    if (pos >= 0) {
      // yes, the requested construction is in the store;
      // get a reference to the firestore public constructions collection
      const pubConstruction = collection(appDB, "constructions");
      // create a public construction object to represent the one we want to add to the firestore
      const publicDoc: PublicConstructionInFirestore = {
        author: firebaseUid.value!,
        constructionDocId: docId
      };
      // add the public construction to firestore
      const q: DocumentReference = await addDoc(pubConstruction, publicDoc);
      // get a reference to the owned construction being made private in firestore
      const ownedDocRef = doc(
        appDB,
        "users",
        firebaseUid.value!,
        "constructions",
        docId
      );

      // update the owned construction in firestore to point to its
      // corresponding public construction
      await updateDoc(ownedDocRef, { publicDocId: q.id });
      // update the owned construction in the local store to point
      // to its corresponding public construction
      privateConstructions.value[pos].publicDocId = q.id;
      // return true to indicate success
      return true;
    } else {
      // no, the requested construction is not in the store;
      // return false to indicate failure
      return false;
    }
  }

  /**
   * update the list of starred constructions for the current user's
   * account
   *
   * @param arr array of starred constructions to write to firebase
   */
  async function updateStarredArrayInFirebase(
    arr: Array<string>
  ): Promise<void> {
    if (firebaseUid.value && publicParsed) {
      const userDocRef = doc(appDB, "users", firebaseUid.value);
      await updateDoc(userDocRef, {
        userStarredConstructions: arr
      });
    }
  }

  /**
   * adjust the star count of a public construction by an arbitrary value; the value
   * is added to the previous value, so updateStarCountInFirebase(id, 2) will change
   * a public construction with ID "id" and previous star count of 3 to have a star count
   * of 5. Note that star counts cannot be negative - if the delta would result in a negative
   * value, the value is clamped to 0.
   *
   * @param pubConstructionId firebase ID of the public construction to adjust the star count of
   * @param byValue amount to change the star count by
   */
  async function updateStarCountInFirebase(
    pubConstructionId: string,
    byValue: number
  ) {
    // get a reference to the public construction in firebase
    const publicDocRef = doc(appDB, "constructions", pubConstructionId);
    // get a snapshot of the public construction document in firebase
    const publicDS: DocumentSnapshot = await getDoc(publicDocRef);
    // does the public document actually exist?
    if (publicDS.exists()) {
      // yes, the public document actually exists;
      // cast the doc's data into a public construction type
      const publicDoc = publicDS.data() as PublicConstructionInFirestore;
      // get a reference to the owned version of the construction
      const ownedDocRef = doc(
        appDB,
        "users",
        publicDoc.author,
        "constructions",
        publicDoc.constructionDocId
      );
      // get a snapshot of the owned construction
      const ownedDS: DocumentSnapshot = await getDoc(ownedDocRef);
      // does the owned construction exist?
      if (ownedDS.exists()) {
        // cast the owned construction's data into a construction type
        const ownedDoc = ownedDS.data() as SphericalConstruction;
        // adjust the star count by the consumer-supplied value within
        // the range [0, inf.]
        if (ownedDoc.starCount + byValue >= 0) {
          await updateDoc(ownedDocRef, { starCount: increment(byValue) });
        } else {
          await updateDoc(ownedDocRef, { starCount: 0 });
        }
      } // no, the owned construction does not exist; do nothing
    } // no, the public construction does not exist; do nothing
  }

  /**
   * star a public construction for the current user
   *
   * @param pubConstructionId the firebase ID of the public construction to star
   */
  function starConstruction(pubConstructionId: string) {
    // find the index of the construction in the local store
    const pos = publicConstructions.value.findIndex(
      (z: SphericalConstruction) => z.publicDocId == pubConstructionId
    );
    // did we find the construction in the local store?
    if (pos >= 0) {
      /*
        yes, we found the construction in the local store:
          1. increment its star count
          2. set its path to an empty string
          3. remove it from the local store's list of public constructions,
          4. add it to the local store's list of starred constructions
          5. update the star count and user's starred list in firebase
       */
      publicConstructions.value[pos].starCount++;
      publicConstructions.value[pos].path = "";
      const inPublic = publicConstructions.value.splice(pos, 1);
      starredConstructions.value.push(...inPublic);
      starredConstructionIDs.value.push(...inPublic.map(z => z.publicDocId!));
      updateStarredArrayInFirebase(starredConstructionIDs.value);
      updateStarCountInFirebase(pubConstructionId, +1);
    } // no, we didn't find the construction in the local store; do nothing
  }

  /**
   * unstar a public construction for the current user
   *
   * @param pubConstructionId firebase ID of the public construction to unstar
   */
  function unstarConstruction(pubConstructionId: string) {
    // find the index of the starred construction in the local store
    const pos = starredConstructions.value.findIndex(
      (z: SphericalConstruction) => z.id == pubConstructionId
    );
    // did we find the construction in the local store?
    if (pos >= 0) {
      /*
        yes, we found the construction in the local store of starred constructions;
        move it from the local store of starred constructions to the local store of
        public constructions, and decrement its star count
      */
      const target = starredConstructions.value[pos];
      if (target.starCount > 0) {
        starredConstructions.value[pos].starCount--;
      }
      const inStarred = starredConstructions.value.splice(pos, 1);
      publicConstructions.value.push(...inStarred);
    } // no, we didn't find the construction in the local store; skip removing it from there
    // find the index of the starred construction in firebase
    const pos2 = starredConstructionIDs.value.findIndex(
      x => x === pubConstructionId
    );
    // did we find the construction in firebase?
    if (pos2 >= 0) {
      /*
        yes, we found the construction in firebase;
        remove it from the user's starred constructions array, then update
        the firebase's copy of both the user's starred constructions array
        and the public construction's star count.
      */
      starredConstructionIDs.value.splice(pos2, 1);

      updateStarredArrayInFirebase(starredConstructionIDs.value);
      updateStarCountInFirebase(pubConstructionId, -1);
    }
  }

  return {
    /* state */
    currentConstructionPreview,
    privateConstructions,
    publicConstructions,
    starredConstructions,
    constructionTree,

    /* functions */
    deleteConstruction,
    initialize,
    loadPublicConstruction,
    makePrivate,
    makePublic,
    saveConstruction,
    starConstruction,
    unstarConstruction
  };
});
