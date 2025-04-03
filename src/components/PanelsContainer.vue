<template>
  <v-text-field
    data-testid="searchInput"
    style="max-height: 3em"
    persistent-hint
    type="text"
    v-model="searchKey"
    variant="outlined"
    density="compact"
    :label="t('searchLabel')"
    :hint="searchResult" />

  <v-expansion-panels
    eager
    v-model="openPanels"
    :multiple="openMultiple"
    :style="{
      gap: '10px',
      paddingRight: '8px',
      paddingLeft: '8px',
      marginTop: searchResult.length > 0 ? '24px' : '0px'
    }">
    <!-- we use the 'value' attribute to control collapsing/expanding multiple panels
    after a search result is found -->
    <v-expansion-panel
      data-testid="privatePanel"
      value="private"
      v-if="firebaseUid && firebaseUid.length > 0">
      <v-expansion-panel-title>
        {{ t(`privateConstructions`) }} ({{
          filteredPrivateConstructions.length
        }})
      </v-expansion-panel-title>
      <v-expansion-panel-text data-testid="privateList">
        <ConstructionList
          :allow-sharing="true"
          :items="filteredPrivateConstructions" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel
      data-testid="starredPanel"
      value="starred"
      v-if="
        filteredStarredConstructions.length > 0 &&
        firebaseUid &&
        firebaseUid.length > 0
      ">
      <v-expansion-panel-title>
        {{ t(`starredConstructions`) }} ({{
          filteredStarredConstructions.length
        }})
      </v-expansion-panel-title>
      <v-expansion-panel-text data-testid="starredList">
        <ConstructionList
          :allow-sharing="false"
          :items="filteredStarredConstructions" />
      </v-expansion-panel-text>
    </v-expansion-panel>
    <v-expansion-panel value="public" data-testid="publicPanel">
      <v-expansion-panel-title>
        {{ t(`publicConstructions`) }} ({{
          filteredPublicConstructions.length
        }})
      </v-expansion-panel-title>
      <v-expansion-panel-text data-testid="publicList">
        <ConstructionList
          :items="filteredPublicConstructions"
          :allow-sharing="false" />
      </v-expansion-panel-text>
    </v-expansion-panel>
  </v-expansion-panels>
</template>

<script lang="ts" setup>
import { defineProps, Ref, ref, onMounted, watch, toRefs } from "vue";
import { useIdle } from "@vueuse/core";
import { useI18n } from "vue-i18n";
import { storeToRefs } from "pinia";
import { SphericalConstruction } from "@/types/ConstructionTypes";
import ConstructionList from "./ConstructionList.vue";
import { useConstructionStore } from "@/stores/construction";
import { useAccountStore } from "@/stores/account";

// Get the translation function
const { t } = useI18n();

/* get the constructions from the store */
const constructionStore = useConstructionStore();
const { publicConstructions, privateConstructions, starredConstructions } =
  storeToRefs(constructionStore);

/* get the user's firebaseid from the account store */
const acctStore = useAccountStore();
const { firebaseUid } = storeToRefs(acctStore);

/* idle timer */
const { idle, reset } = useIdle(500); // wait for 0.5 second idle

// Define props for the component
// const props = defineProps({});

/* filtered arrays for search functionality */
const filteredPrivateConstructions: Ref<Array<SphericalConstruction>> = ref([]);
const filteredPublicConstructions: Ref<Array<SphericalConstruction>> = ref([]);
const filteredStarredConstructions: Ref<Array<SphericalConstruction>> = ref([]);

/* populate the filtered arrays */
onMounted(() => {
  filteredPublicConstructions.value.push(...publicConstructions.value);
  filteredPrivateConstructions.value.push(...privateConstructions.value);
  filteredStarredConstructions.value.push(...starredConstructions.value);
});

/* variables for the vue components */
const searchResult = ref("");
const searchKey = ref("");
const openPanels: Ref<Array<string> | string> = ref("");
const openMultiple = ref(false);

let lastSearchKey: string | null = null;

watch(idle, (isIdle: boolean) => {
  if (!isIdle) {
    return;
  }
  if (lastSearchKey === searchKey.value) {
    reset();
    return;
  }
  if (searchKey.value.length == 0) {
    searchResult.value = "";
    // If no search key, reset all the arr to full contents
    filteredPublicConstructions.value.splice(0);
    filteredPrivateConstructions.value.splice(0);
    filteredStarredConstructions.value.splice(0);
    filteredPublicConstructions.value.push(...publicConstructions.value);
    filteredPrivateConstructions.value.push(...privateConstructions.value);
    filteredStarredConstructions.value.push(...starredConstructions.value);
  } else {
    lastSearchKey = searchKey.value;
    //openPanels.value.splice(0);
    searchResult.value = "";
    const matchFound = [];
    const privateMatch = privateConstructions.value.filter(
      (c: SphericalConstruction) =>
        c.description.toLowerCase().includes(searchKey.value.toLowerCase())
    );
    if (privateMatch.length > 0) {
      matchFound.push("private");
      filteredPrivateConstructions.value = privateMatch;
    } else {
      filteredPrivateConstructions.value.splice(0);
    }
    const publicMatch = publicConstructions.value.filter(
      (c: SphericalConstruction) =>
        c.description.toLowerCase().includes(searchKey.value.toLowerCase())
    );
    if (publicMatch.length > 0) {
      matchFound.push("public");
      filteredPublicConstructions.value = publicMatch;
    } else {
      filteredPublicConstructions.value.splice(0);
    }
    const starredMatch = starredConstructions.value.filter(
      (c: SphericalConstruction) =>
        c.description.toLowerCase().includes(searchKey.value.toLowerCase())
    );
    if (starredMatch.length > 0) {
      matchFound.push("starred");
      filteredStarredConstructions.value = starredMatch;
    } else {
      filteredStarredConstructions.value.splice(0);
    }
    if (matchFound.length > 1) {
      openMultiple.value = true;
      openPanels.value = matchFound;
      searchResult.value = t(`foundMultiple`, {
        privateCount: privateMatch.length,
        publicCount: publicMatch.length,
        starredCount: privateMatch.length
      });
    } else {
      openMultiple.value = false;
      openPanels.value = matchFound[0];
      searchResult.value = t("foundSingle", {
        count: (privateMatch?.length ?? 0) + publicMatch.length,
        group: matchFound[0]
      });
    }
  }
  reset();
});

watch(
  [
    () => privateConstructions.value,
    () => publicConstructions.value,
    () => starredConstructions.value
  ],
  ([privateList, publicList, starredList]) => {
    filteredPrivateConstructions.value.splice(0);
    filteredPrivateConstructions.value.push(...privateList);
    filteredPublicConstructions.value.splice(0);
    filteredPublicConstructions.value.push(...publicList);
    filteredStarredConstructions.value.splice(0);
    filteredStarredConstructions.value.push(...starredList);
  },
  { deep: true }
);
</script>
<i18n locale="en" lang="json">
{
  "privateConstructions": "Private Constructions",
  "publicConstructions": "Public Constructions",
  "starredConstructions": "Starred Constructions",
  "foundMultiple": "Found {privateCount} private, {publicCount} public, and {starredCount} starred constructions",
  "foundSingle": "Found {count} {group} construction | Found {count} {group} constructions"
}
</i18n>
