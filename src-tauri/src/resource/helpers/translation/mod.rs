pub mod cache;

use cache::{
  RESOURCE_TRANSLATION_CACHE_EXPIRY_HOURS, ResourceTranslationEntry, ResourceTranslationsCache,
};
use futures::StreamExt;
use sjmcl_types::error::SJMCLResult;
use sjmcl_types::storage::Storage;
use std::sync::Mutex;
use tauri::{AppHandle, Manager};

use crate::launcher_config::models::LauncherConfig;
use crate::resource::helpers::curseforge::misc::translate_description_curseforge;
use crate::resource::helpers::mod_db::ModDataBase;
use crate::resource::helpers::modrinth::misc::translate_description_modrinth;
use crate::resource::models::{OtherResourceInfo, OtherResourceSource};
use crate::utils::string::contains_chinese;

pub async fn apply_other_resource_enhancements(
  app: &AppHandle,
  resource_info: &mut OtherResourceInfo,
) -> SJMCLResult<()> {
  // Extract data from cache in a limited scope to avoid holding lock across await
  let (translated_name, mcmod_id) = {
    if let Ok(cache) = app.state::<Mutex<ModDataBase>>().lock() {
      let translated_name = if resource_info._type == "mod" {
        cache.get_translated_name(&resource_info.slug, &resource_info.source)
      } else {
        None
      };
      let mcmod_id = cache.get_mcmod_id(&resource_info.slug, &resource_info.source);
      (translated_name, mcmod_id)
    } else {
      (None, None)
    }
  };

  if let Some(name) = translated_name
    && contains_chinese(&name)
  {
    resource_info.translated_name = Some(name);
  }
  if let Some(id) = mcmod_id {
    resource_info.mcmod_id = id;
  }

  if !should_translate_resource_description(app) {
    return Ok(());
  }

  let translation_cache_key =
    ResourceTranslationsCache::cache_key(&resource_info.source, &resource_info.id);
  if let Ok(cache) = app.state::<Mutex<ResourceTranslationsCache>>().lock() {
    if let Some(entry) = cache.translations.get(&translation_cache_key)
      && !entry.is_expired(RESOURCE_TRANSLATION_CACHE_EXPIRY_HOURS)
    {
      if let Some(translated_name) = &entry.translated_name
        && resource_info.translated_name.is_none()
      {
        resource_info.translated_name = Some(translated_name.clone());
      }
      if entry.translated_description.is_some() || entry.description_translated {
        resource_info.translated_description = entry.translated_description.clone();
        return Ok(());
      }
    }
  }

  let translated_desc = translate_resource_description(app, resource_info).await?;

  if let Ok(mut cache) = app.state::<Mutex<ResourceTranslationsCache>>().lock() {
    cache.translations.insert(
      translation_cache_key,
      ResourceTranslationEntry::new(
        resource_info.translated_name.clone(),
        translated_desc.clone(),
        true,
      ),
    );
    let _ = cache.save();
  }

  if let Some(desc) = translated_desc {
    resource_info.translated_description = Some(desc);
  }

  Ok(())
}

pub async fn apply_other_resource_enhancements_concurrently(
  app: &AppHandle,
  list: &mut Vec<OtherResourceInfo>,
) {
  let concurrency = std::thread::available_parallelism()
    .map(usize::from)
    .unwrap_or(4);

  let mut enhanced = futures::stream::iter(std::mem::take(list).into_iter().enumerate())
    .map(|(index, mut resource_info)| async move {
      let _ = apply_other_resource_enhancements(app, &mut resource_info).await;
      (index, resource_info)
    })
    .buffer_unordered(concurrency)
    .collect::<Vec<_>>()
    .await;

  enhanced.sort_by_key(|(index, _)| *index);
  *list = enhanced
    .into_iter()
    .map(|(_, resource_info)| resource_info)
    .collect();
}

fn should_translate_resource_description(app: &AppHandle) -> bool {
  app
    .state::<Mutex<LauncherConfig>>()
    .lock()
    .map(|config| {
      config.general.general.language == "zh-Hans"
        && config.general.functionality.resource_translation
    })
    .unwrap_or(false)
}

async fn translate_resource_description(
  app: &AppHandle,
  resource_info: &OtherResourceInfo,
) -> SJMCLResult<Option<String>> {
  match resource_info.source {
    OtherResourceSource::Modrinth => translate_description_modrinth(app, &resource_info.id).await,
    OtherResourceSource::CurseForge => {
      translate_description_curseforge(app, &resource_info.id).await
    }
    _ => Ok(None),
  }
}
