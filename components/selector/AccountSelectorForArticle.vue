<template>
  <USelectMenu
    v-model="selected"
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
      <UAvatar
        v-if="selected"
        :src="selected.round_head_img ? IMAGE_PROXY + selected.round_head_img : '/avatar-default.png'"
        size="2xs"
      />
      <span v-if="selected" class="max-w-[120px] sm:max-w-[200px] truncate">{{ selected.nickname }}</span>
      <span v-if="selected" class="shrink-0 text-slate-400 dark:text-slate-500 font-mono text-xs">({{ selected.articles }}篇)</span>
    </template>
    <template #option="{ option: account }">
      <UAvatar
        :src="account.round_head_img ? IMAGE_PROXY + account.round_head_img : '/avatar-default.png'"
        size="sm"
      />
      <div>
        <p class="text-[15px] font-medium text-slate-800 dark:text-slate-200">{{ account.nickname }}</p>
        <p class="text-slate-400 dark:text-slate-500 text-xs">已加载文章数: {{ account.articles }}</p>
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
import { IMAGE_PROXY } from '~/config';
import { getAllInfo, type MpAccount } from '~/store/v2/info';

// 已缓存的公众号信息（排除特殊的单篇临时缓存占位符）
const cachedAccountInfos = (await getAllInfo()).filter(item => item.fakeid !== 'SINGLE_ARTICLE_FAKEID');

// 在静态数据上原位排序，保持数组引用绝对稳定
cachedAccountInfos.sort((a, b) => b.articles - a.articles);

const sortedAccountInfos = cachedAccountInfos;

const selected = defineModel<MpAccount | undefined>();
</script>
