import { Matrix4 } from "three";
import { ActionMode } from "..";
import { Ref } from "vue";

export type ConstructionScript = Array<string | Array<string>>;

export interface SphericalConstruction extends ConstructionInFirestore {
  starCount: number;
  id: string;
  parsedScript: ConstructionScript;
  sphereRotationMatrix: Matrix4;
  objectCount: number;
  // previewData: string;
}

export interface PublicConstructionInFirestore {
  /** Firebase Auth UID of the construction owner */
  author: string;
  /** Firebase ID for the construction this references */
  constructionDocId: string;
  /** date that this construction was made public */
  datePublicized?: string;
}

export interface ConstructionInFirestore {
  version: string;
  author: string;
  dateCreated: string;
  script: string;
  description: string;
  starCount: number;
  rotationMatrix?: string;
  preview: string; // Either the data:image of the URL to the data:image
  aspectRatio?: number /* width / height of the screen when image was captured */;
  publicDocId?: string; // linked to the document with structure PublicConstructionInFirebase
  // A list of enabled tool buttons associated with this construction
  tools: Array<ActionMode> | undefined;
  /** organizational path of the construction */
  path?: string;
}

export interface StarredConstruction {
  id: string;
  path: string;
}

/**
 * TreeviewNode representation with helper classes
 */
export class TreeviewNode {
  public id: string;
  public title: string;
  public leaf: boolean;
  public children?: Array<TreeviewNode>;

  constructor(id: string, title: string, leaf?: boolean) {
    this.id = id;
    this.title = title;
    this.leaf = leaf ?? false;
  }

  /**
   * get a copy of this node; does not copy children.
   */
  public copy(): TreeviewNode {
    return new TreeviewNode(this.id, this.title, this.leaf);
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

export class ConstructionTree {
  /** the root of our tree */
  private root: Array<TreeviewNode>;

  /** a number stored at the root of the object to give vue's watchers something to check */
  private updateCounter: number;

  /** index of the public constructions in the root node's children */
  private readonly publicIdx = 0;
  /** index of the owned constructions in the root node's children */
  private readonly ownedIdx = 1;
  /** index of the starred constructions in the root node's children */
  private readonly starredIdx = 2;

  public constructor(root_title: string) {
    /* ensure root has space for 3 children allocated for the public/owned/starred constructions */
    this.root = Array<TreeviewNode>(3);

    /* we don't list public constructions in the view this tree is meant to represent,
     * but the user should still be able to select the "folder" containing them so that
     * they can view the public constructions */
    this.root[this.publicIdx] = new TreeviewNode(
      "Public Constructions",
      "Public Constructions",
      false
    );
    this.root[this.ownedIdx] = new TreeviewNode(
      "Owned Constructions",
      "Owned Constructions",
      false
    );
    this.root[this.starredIdx] = new TreeviewNode(
      "Starred Constructions",
      "Starred Constructions",
      false
    );

    this.updateCounter = 0;
  }

  /**
   * clear any existing constructions and build the tree based on the
   * given lists of public, owned, and starred constructions.
   *
   * @param ownedConstructions
   * @param starredConstructions
   */
  public fromArrays(
    ownedConstructions: Ref<Array<SphericalConstruction>>,
    starredConstructions: Ref<Array<SphericalConstruction>>
  ) {
    this.clear();
    this.addOwnedConstructions(...ownedConstructions.value);
    this.addStarredConstructions(...starredConstructions.value);
    this.updateCounter++;
  }

  /** append one or more construction to the owned constructions subtree */
  public addOwnedConstructions(...constructions: SphericalConstruction[]) {
    constructions.forEach(construction => {
      this.root[this.ownedIdx].appendChildConstruction(construction);
    });
    this.updateCounter++;
  }

  /**
   * clear the owned constructions and replace them with a new list
   */
  public setOwnedConstructions(
    constructions: Ref<Array<SphericalConstruction>>
  ) {
    this.root[this.ownedIdx].children?.clear();
    this.addOwnedConstructions(...constructions.value);
    this.updateCounter++;
  }

  /** append one or more constructions to the starred constructions subtree */
  public addStarredConstructions(...constructions: SphericalConstruction[]) {
    constructions.forEach(construction => {
      this.root[this.starredIdx].appendChildConstruction(construction);
    });
    this.updateCounter++;
  }

  /**
   * clear the starred constructions and replace them with a new list
   */
  public setStarredConstructions(
    constructions: Ref<Array<SphericalConstruction>>
  ) {
    this.root[this.starredIdx].children?.clear();
    this.addStarredConstructions(...constructions.value);
    this.updateCounter++;
  }

  /**
   * get a copy of the tree without any of the leaves, leaving only the folders
   */
  public getLeafless(): Array<TreeviewNode> {
    var leafless: Array<TreeviewNode> = [];

    this.root.forEach(rootNode => {
      leafless.push(rootNode.copy());
      leafless.at(-1)!.children = this._getLeafless(rootNode);
    });

    return leafless;
  }

  /**
   * recursive function to get all the non-leaf nodes in the tree. GetLeafless() without
   * the leading underscore is provided as a public interface since we can't directly recurse
   * on the top level of the tree; instead we have to iterate over the top level and recurse on
   * each root node.
   *
   * @param node current node
   */
  private _getLeafless(node: TreeviewNode): Array<TreeviewNode> | undefined {
    /* base case: node with no children */
    if (
      node.children === null ||
      node.children === undefined ||
      node.children!.length == 0
    ) {
      return undefined;
    }

    var leafless: Array<TreeviewNode> = [];

    node.children!.forEach(child => {
      if (!child.leaf) {
        /* copy the child */
        var copy: TreeviewNode = child.copy();
        /* add it to the array */
        leafless.push(copy);
        /* recurse on the child */
        const children = this._getLeafless(child);
        if (children != undefined && children.length > 0) {
          copy.children = children;
        } else {
          /* previously non-leaf nodes must now become leaf nodes to avoid looking weird
           * in the UI */
          copy.leaf = true;
        }
      }
    });

    return leafless;
  }

  /**
   * @returns an array containing the root node of the tree structure
   */
  public getRoot(): Array<TreeviewNode> {
    /*
     * I don't like this function since it returns a mutable reference to the private root element
     * this class maintains, but it's not worth it to make a deep copy every time and it is necessary for
     * the root to be accessible outside of this class since the treeview component needs to use it.
     */
    return this.root;
  }

  /**
   * clear the construction tree, leaving only the 3 subtrees.
   */
  private clear() {
    this.root.forEach(x => {
      x.children?.clear();
    });
  }
}
