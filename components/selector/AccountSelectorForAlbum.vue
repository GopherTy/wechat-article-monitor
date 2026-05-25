<template>
  <USelectMenu
    v-model="selected"
    by="fakeid"
    size="md"
    color="gray"
    searchable
    searchable-placeholder="筛选公众号..."
    clear-search-on-close
    :options="sortedAccountInfos"
    option-attribute="nickname"
    placeholder="请选择公众号"
  >
    <template #label>
      <UAvatar v-if="selected" :src="getAvatarUrl(selected.round_head_img)" size="2xs" />
      <span v-if="selected" class="max-w-30 line-clamp-1">{{ selected.nickname }}</span>
      <span v-if="selected" class="shrink-0">({{ selected.albums?.length || 0 }}个合集)</span>
    </template>
    <template #option="{ option: account }">
      <UAvatar :src="getAvatarUrl(account.round_head_img)" size="sm" />
      <div>
        <p class="text-[16px]">{{ account.nickname }}</p>
        <p class="text-gray-500 text-sm">合集数: {{ account.albums?.length || 0 }}</p>
      </div>
    </template>
    <template #option-empty="{ query }">
      未找到匹配「{{ query }}」的公众号<br />请先在「<NuxtLink
        to="/dashboard/account"
        class="text-blue-500 hover:underline"
        >公众号管理</NuxtLink
      >」中添加
    </template>
    <template #empty>
      暂无公众号，请先在「<NuxtLink to="/dashboard/account" class="text-blue-500 hover:underline">公众号管理</NuxtLink
      >」中添加
    </template>
  </USelectMenu>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';
import { IMAGE_PROXY } from '~/config';
import { getArticleCache } from '~/store/v2/article';
import { getAllInfo, type MpAccount } from '~/store/v2/info';
import type { AppMsgAlbumInfo } from '~/types/types';

interface AccountInfo extends MpAccount {
  albums?: AppMsgAlbumInfo[];
}

const selected = defineModel<AccountInfo | undefined>();

// 已缓存的公众号信息
const cachedAccountInfos = ref<AccountInfo[]>([]);

onMounted(async () => {
  try {
    const list: AccountInfo[] = await getAllInfo();
    cachedAccountInfos.value = list;

    // 异步加载合集信息
    for (const accountInfo of list) {
      accountInfo.albums = await getAllAlbums(accountInfo.fakeid);
    }
  } catch (err) {
    console.error('[AccountSelectorForAlbum] Failed to load accounts:', err);
  }
});

const sortedAccountInfos = computed(() => {
  const filtered = cachedAccountInfos.value.filter(item => item.fakeid !== 'SINGLE_ARTICLE_FAKEID');
  filtered.sort((a, b) => {
    const aLen = a.albums?.length || 0;
    const bLen = b.albums?.length || 0;
    return bLen - aLen;
  });
  return filtered;
});

// 获取公众号下所有的合集数据（根据已缓存的文章数据）
async function getAllAlbums(fakeid: string) {
  try {
    const articles = await getArticleCache(fakeid, Math.floor(Date.now() / 1000));
    const albums: AppMsgAlbumInfo[] = [];
    articles
      .flatMap(article => article.appmsg_album_infos || [])
      .forEach(album => {
        if (album && !albums.some(a => a.id === album.id)) {
          albums.push(album);
        }
      });
    return albums;
  } catch (err) {
    console.error('[AccountSelectorForAlbum] Failed to load albums for:', fakeid, err);
    return [];
  }
}

// 微信防盗链代理与默认头像路径安全判断函数
function getAvatarUrl(url?: string) {
  if (!url) return '/avatar-default.png';
  if (url.startsWith('http://') || url.startsWith('https://')) {
    return IMAGE_PROXY + url;
  }
  return url;
}
</script>
