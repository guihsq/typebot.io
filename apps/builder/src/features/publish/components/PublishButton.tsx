import { ConfirmModal } from "@/components/ConfirmModal";
import { TextLink } from "@/components/TextLink";
import {
  ChevronLeftIcon,
  CloudOffIcon,
  LockedIcon,
  UnlockedIcon,
} from "@/components/icons";
import { ChangePlanModal } from "@/features/billing/components/ChangePlanModal";
import { isFreePlan } from "@/features/billing/helpers/isFreePlan";
import { useTypebot } from "@/features/editor/providers/TypebotProvider";
import { useWorkspace } from "@/features/workspace/WorkspaceProvider";
import { useTimeSince } from "@/hooks/useTimeSince";
import { queryClient, trpc } from "@/lib/queryClient";
import { toast } from "@/lib/toast";
import {
  Button,
  type ButtonProps,
  HStack,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  Stack,
  Text,
  Tooltip,
  useDisclosure,
} from "@chakra-ui/react";
import { useMutation } from "@tanstack/react-query";
import { T, useTranslate } from "@tolgee/react";
import { InputBlockType } from "@typebot.io/blocks-inputs/constants";
import { isNotDefined } from "@typebot.io/lib/utils";
import { useRouter } from "next/router";
import { parseDefaultPublicId } from "../helpers/parseDefaultPublicId";

type Props = ButtonProps & {
  isMoreMenuDisabled?: boolean;
};
export const PublishButton = ({
  isMoreMenuDisabled = false,
  ...props
}: Props) => {
  const { t } = useTranslate();
  const { workspace } = useWorkspace();
  const { push, query, pathname } = useRouter();
  const { isOpen, onOpen, onClose } = useDisclosure();
  const {
    isOpen: isNewEngineWarningOpen,
    onOpen: onNewEngineWarningOpen,
    onClose: onNewEngineWarningClose,
  } = useDisclosure();
  const {
    isPublished,
    publishedTypebot,
    restorePublishedTypebot,
    typebot,
    isSavingLoading,
    updateTypebot,
    save,
    publishedTypebotVersion,
    currentUserMode,
  } = useTypebot();
  const timeSinceLastPublish = useTimeSince(
    publishedTypebot?.updatedAt.toString(),
  );

  const { mutate: publishTypebotMutate, status: publishTypebotStatus } =
    useMutation(
      trpc.typebot.publishTypebot.mutationOptions({
        onError: (error) => {
          toast({
            context: t("publish.error.label"),
            description: error.message,
          });
          if (error.data?.httpStatus === 403) {
            setTimeout(() => {
              window.location.reload();
            }, 3000);
          }
        },
        onSuccess: () => {
          if (!typebot?.id || currentUserMode === "guest") return;
          queryClient.invalidateQueries({
            queryKey: trpc.typebot.getPublishedTypebot.queryKey(),
          });
          if (!publishedTypebot && !pathname.endsWith("share"))
            push(`/typebots/${query.typebotId}/share`);
        },
      }),
    );

  const { mutate: unpublishTypebotMutate, status: unpublishTypebotStatus } =
    useMutation(
      trpc.typebot.unpublishTypebot.mutationOptions({
        onError: (error) =>
          toast({
            context: t("editor.header.unpublishTypebot.error.label"),
            description: error.message,
          }),
        onSuccess: () => {
          queryClient.invalidateQueries({
            queryKey: trpc.typebot.getPublishedTypebot.queryKey(),
          });
        },
      }),
    );

  const hasInputFile = typebot?.groups
    .flatMap((g) => g.blocks)
    .some((b) => b.type === InputBlockType.FILE);

  const handlePublishClick = async () => {
    if (!typebot?.id) return;
    if (isFreePlan(workspace) && hasInputFile) return onOpen();
    await save(
      !typebot.publicId
        ? { publicId: parseDefaultPublicId(typebot.name, typebot.id) }
        : undefined,
      true,
    );
    publishTypebotMutate({
      typebotId: typebot.id,
    });
  };

  const unpublishTypebot = async () => {
    if (!typebot?.id) return;
    if (typebot.isClosed)
      await updateTypebot({ updates: { isClosed: false }, save: true });
    unpublishTypebotMutate({
      typebotId: typebot?.id,
    });
  };

  const closeTypebot = async () => {
    await updateTypebot({ updates: { isClosed: true }, save: true });
  };

  const openTypebot = async () => {
    await updateTypebot({ updates: { isClosed: false }, save: true });
  };

  return (
    <HStack spacing="1px">
      <ChangePlanModal
        isOpen={isOpen}
        onClose={onClose}
        type={t("billing.limitMessage.fileInput")}
      />
      {publishedTypebot && publishedTypebotVersion !== typebot?.version && (
        <ConfirmModal
          isOpen={isNewEngineWarningOpen}
          onConfirm={handlePublishClick}
          onClose={onNewEngineWarningClose}
          confirmButtonColor="blue"
          title={t("publish.versionWarning.title.label")}
          message={
            <Stack spacing="3">
              <Text>
                {t("publish.versionWarning.message.aboutToDeploy.label")}
              </Text>
              <Text fontWeight="bold">
                <T
                  keyName="publish.versionWarning.checkBreakingChanges"
                  params={{
                    link: (
                      <TextLink
                        href="https://docs.typebot.io/breaking-changes#typebot-v6"
                        isExternal
                      />
                    ),
                  }}
                />
              </Text>
              <Text>
                {t("publish.versionWarning.message.testInPreviewMode.label")}
              </Text>
            </Stack>
          }
          confirmButtonLabel={t("publishButton.label")}
        />
      )}
      <Tooltip
        placement="bottom-end"
        label={
          <Stack>
            <Text>{t("publishButton.tooltip.nonPublishedChanges.label")}</Text>
            {timeSinceLastPublish ? (
              <Text fontStyle="italic">
                <T
                  keyName="publishButton.tooltip.publishedVersion.from.label"
                  params={{
                    timeSince: timeSinceLastPublish,
                  }}
                />
              </Text>
            ) : null}
          </Stack>
        }
        isDisabled={isNotDefined(publishedTypebot) || isPublished}
      >
        <Button
          colorScheme="orange"
          isLoading={
            publishTypebotStatus === "pending" ||
            unpublishTypebotStatus === "pending"
          }
          isDisabled={isPublished || isSavingLoading}
          onClick={() => {
            publishedTypebot && publishedTypebotVersion !== typebot?.version
              ? onNewEngineWarningOpen()
              : handlePublishClick();
          }}
          borderRightRadius={
            publishedTypebot && !isMoreMenuDisabled ? 0 : undefined
          }
          {...props}
        >
          {isPublished
            ? typebot?.isClosed
              ? t("publishButton.closed.label")
              : t("publishButton.published.label")
            : t("publishButton.label")}
        </Button>
      </Tooltip>

      {!isMoreMenuDisabled && publishedTypebot && (
        <Menu isLazy>
          <MenuButton
            as={IconButton}
            colorScheme="orange"
            borderLeftRadius={0}
            icon={<ChevronLeftIcon transform="rotate(-90deg)" />}
            aria-label={t("publishButton.dropdown.showMenu.label")}
            size="sm"
            isDisabled={publishTypebotStatus === "pending" || isSavingLoading}
          />
          <MenuList>
            {!isPublished && (
              <MenuItem onClick={restorePublishedTypebot}>
                {t("publishButton.dropdown.restoreVersion.label")}
              </MenuItem>
            )}
            {!typebot?.isClosed ? (
              <MenuItem onClick={closeTypebot} icon={<LockedIcon />}>
                {t("publishButton.dropdown.close.label")}
              </MenuItem>
            ) : (
              <MenuItem onClick={openTypebot} icon={<UnlockedIcon />}>
                {t("publishButton.dropdown.reopen.label")}
              </MenuItem>
            )}
            <MenuItem onClick={unpublishTypebot} icon={<CloudOffIcon />}>
              {t("publishButton.dropdown.unpublish.label")}
            </MenuItem>
          </MenuList>
        </Menu>
      )}
    </HStack>
  );
};
