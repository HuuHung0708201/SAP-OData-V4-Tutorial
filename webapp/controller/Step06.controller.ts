import Controller from "sap/ui/core/mvc/Controller";
import UIComponent from "sap/ui/core/UIComponent";
import History from "sap/ui/core/routing/History";
import JSONModel from "sap/ui/model/json/JSONModel";
import MessageBox from "sap/m/MessageBox";
import MessageToast from "sap/m/MessageToast";
import type ODataListBinding from "sap/ui/model/odata/v2/ODataListBinding";
import type ODataModelV2 from "sap/ui/model/odata/v2/ODataModel";
import type ODataModel from "sap/ui/model/odata/v2/ODataModel";
import type ResourceModel from "sap/ui/model/resource/ResourceModel";
import type Event from "sap/ui/base/Event";
import type Input from "sap/m/Input";
import { ValueState } from "sap/ui/core/library";
import Filter from "sap/ui/model/Filter";
import Sorter from "sap/ui/model/Sorter";
import FilterOperator from "sap/ui/model/FilterOperator";
import FilterType from "sap/ui/model/FilterType";
import type ListBinding from "sap/ui/model/ListBinding";
import Messaging from "sap/ui/core/Messaging";
import type Context from "sap/ui/model/Context";
import type Table from "sap/m/Table";
import type Message from "sap/ui/core/message/Message";

export default class Step06 extends Controller {
  // public override onInit(): void {
  //   let oData = {
  //     busy: false,
  //     order: 0,
  //   };
  //   let oModel = new JSONModel(oData);
  //   this.getView()?.setModel(oModel, "appView");
  // }

  private _bTechnicalErrors: boolean = false;

  public override onInit(): void {
    // Khởi tạo JSONModel cho appView
    const oData = {
      busy: false,
      hasUIChanges: false,
      usernameEmpty: true,
      order: 0,
    };
    const oAppViewModel = new JSONModel(oData);
    this.getView()?.setModel(oAppViewModel, "appView");

    // Lấy MessageModel
    const oMessageModel = Messaging.getMessageModel();
    this.getView()?.setModel(oMessageModel, "message");

    // Tạo ListBinding chỉ lấy các message technical (technical = true)
    const oMessageModelBinding = oMessageModel.bindList(
      "/", // path
      undefined, // context
      [], // sorter
      new Filter("technical", FilterOperator.EQ, true) // filter
    ) as ListBinding;

    // Attach sự kiện thay đổi cho binding
    oMessageModelBinding.attachChange(this.onMessageBindingChange, this);

    // Biến cờ technical errors
    this._bTechnicalErrors = false;
  }

  public onNavBack(): void {
    const history = History.getInstance();
    const previousHash = history.getPreviousHash();

    if (previousHash !== undefined) {
      window.history.go(-1);
    } else {
      const router = UIComponent.getRouterFor(this);
      router.navTo("RouteMain", {}, true);
    }
  }

  public async onRefresh(): Promise<void> {
    // Lấy JSONModel "appView" từ view, dùng để quản lý trạng thái UI (ví dụ: hasUIChanges)
    const appViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;

    // Kiểm tra nếu UI đang có thay đổi chưa lưu (hasUIChanges = true)
    // Nếu có, không cho phép refresh
    if (appViewModel?.getProperty("/hasUIChanges")) {
      // Lấy thông điệp lỗi từ i18n (async vì _getText trả Promise)
      const msg = await this._getText("refreshNotPossibleMessage");
      // Hiển thị hộp thoại lỗi cho người dùng
      MessageBox.error(msg);
      return; // thoát khỏi hàm, không refresh
    }

    // Lấy binding của Table theo id "peopleList" và path "items"
    const binding = this.byId("peopleList")?.getBinding("items") as ODataListBinding;

    // Nếu tìm thấy binding, refresh dữ liệu từ OData service
    if (binding) binding.refresh();

    // Lấy thông điệp thành công từ i18n
    const successMsg = await this._getText("refreshSuccessMessage");
    // Hiển thị thông báo toast cho người dùng
    MessageToast.show(successMsg);
  }

  // Helper async để lấy text từ i18n (có thể hỗ trợ đa ngôn ngữ)
  private async _getText(sTextId: string, aArgs?: any[]): Promise<string> {
    // Lấy ResourceModel i18n từ Component
    const oModel = this.getOwnerComponent()?.getModel("i18n") as ResourceModel;

    // Nếu không tìm thấy model → trả fallback là chính sTextId
    if (!oModel) {
      return sTextId;
    }

    try {
      // getResourceBundle trả về Promise<ResourceBundle>
      const oBundle = await oModel.getResourceBundle();

      // Lấy text từ bundle, nếu undefined thì fallback về sTextId
      return oBundle?.getText(sTextId, aArgs) ?? sTextId;
    } catch (err) {
      // Nếu có lỗi khi lấy bundle → fallback
      return sTextId;
    }
  }

  public onAgeChange(event: Event): void {
    // Lấy đối tượng Input mà người dùng vừa thay đổi từ event
    const input = event.getSource() as Input;

    // Lấy giá trị hiện tại của Input dưới dạng chuỗi
    const value = input.getValue(); // V2 không có event.getParameter("valid"), phải validate thủ công

    // Kiểm tra xem giá trị có phải là số nguyên dương hay không
    // Biểu thức /^\d+$/ sẽ chỉ match các chuỗi chỉ chứa chữ số 0-9 (không âm, không thập phân)
    if (!/^\d+$/.test(value)) {
      // Nếu không hợp lệ, hiển thị hộp thoại lỗi
      MessageBox.error("Age phải là số nguyên >= 0");

      // Đánh dấu trạng thái của Input là Error (màu đỏ, hiển thị lỗi)
      input.setValueState(ValueState.Error);

      // Thiết lập text hiển thị khi hover vào Input báo lỗi
      input.setValueStateText("Age phải là số nguyên >= 0");
    } else {
      // Nếu hợp lệ, xóa trạng thái lỗi, hiển thị bình thường
      input.setValueState(ValueState.None);
    }
  }

  // Hàm tìm kiếm theo LastName
  public onSearch(): void {
    // Lấy View hiện tại của Controller
    const view = this.getView();

    // Lấy control Input theo ID "searchField" và ép kiểu Input cho TypeScript
    const input = view?.byId("searchField") as Input | undefined;

    // Lấy giá trị người dùng nhập vào ô tìm kiếm, fallback là chuỗi rỗng nếu input undefined
    const value = input?.getValue() ?? "";

    // Tạo filter: tìm các bản ghi có LastName chứa giá trị nhập
    const filter = new Filter("LastName", FilterOperator.Contains, value);

    // Lấy binding của Table (sap.m.Table) theo ID "peopleList"
    const binding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại thì áp dụng filter ở mức ứng dụng
    if (binding) {
      binding.filter([filter], FilterType.Application);
    }
  }

  // Hàm sắp xếp LastName với trạng thái xoay vòng: none -> asc -> desc
  public async onSort(): Promise<void> {
    // Lấy View hiện tại
    const view = this.getView();

    // Mảng trạng thái sắp xếp: undefined = không sắp xếp, "asc" = tăng dần, "desc" = giảm dần
    const states: Array<undefined | "asc" | "desc"> = [undefined, "asc", "desc"];

    // Mảng key i18n tương ứng để hiển thị thông báo
    const aStateTextIds = ["sortNone", "sortAscending", "sortDescending"];

    // Lấy trạng thái hiện tại từ JSONModel appView
    const iOrder = (view?.getModel("appView")?.getProperty("/order") as number) ?? 0;

    // Tính trạng thái tiếp theo theo vòng lặp
    const iNextOrder = (iOrder + 1) % states.length;

    // Lấy trạng thái tiếp theo
    const sOrder = states[iNextOrder];

    // Lấy JSONModel của appView và cập nhật trạng thái order
    const oAppViewModel = view?.getModel("appView") as JSONModel | undefined;
    oAppViewModel?.setProperty("/order", iNextOrder);

    // Lấy binding của Table "peopleList"
    const oBinding = view?.byId("peopleList")?.getBinding("items") as ListBinding | undefined;

    // Nếu binding tồn tại, áp dụng sắp xếp theo LastName
    if (oBinding) {
      oBinding.sort(sOrder ? [new Sorter("LastName", sOrder === "desc")] : []);
    }

    // Chuỗi hiển thị trong thông báo (ví dụ tên cột LastName)
    const sLastName = "LastName";

    // Lấy i18n ResourceModel
    const oI18nModel = view?.getModel("i18n") as ResourceModel | undefined;

    // Khởi tạo message rỗng
    let sMessage = "";

    // Nếu model i18n tồn tại, lấy ResourceBundle và lấy text thông báo theo trạng thái
    if (oI18nModel) {
      const oBundle = await oI18nModel.getResourceBundle(); // Promise vì async
      sMessage = oBundle.getText(aStateTextIds[iNextOrder], [sLastName]) ?? "";
    }

    // Hiển thị thông báo toast
    MessageToast.show(sMessage);
  }

  private _setUIChanges(hasUIChanges?: boolean): void {
    // Nếu đang có lỗi kỹ thuật, buộc luôn đánh dấu UI có thay đổi
    if (this._bTechnicalErrors) {
      hasUIChanges = true;
    }
    // Nếu không truyền tham số hasUIChanges, tự động kiểm tra trạng thái pending changes
    else if (hasUIChanges === undefined) {
      // Lấy default OData model từ view
      const defaultModel = this.getView()?.getModel() as any;
      // Kiểm tra xem model có pending changes chưa submit không
      // Nếu có, hasUIChanges = true, ngược lại = false
      hasUIChanges = defaultModel?.hasPendingChanges?.() ?? false;
    }

    // Lấy JSONModel "appView" dùng để bind các trạng thái UI
    const appViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
    // Cập nhật property /hasUIChanges trong model
    // Control nào bind thuộc tính enabled vào /hasUIChanges sẽ tự động enable/disable
    appViewModel?.setProperty("/hasUIChanges", hasUIChanges);
  }

  public onCreate(): void {
    // Lấy Table theo ID
    const list = this.byId("peopleList") as Table | undefined;
    if (!list) return;

    // Lấy binding của items
    const binding = list.getBinding("items") as ODataListBinding | undefined;
    if (!binding) return;

    // Tạo context mới
    const context: Context | undefined = binding.create({
      UserName: "",
      FirstName: "",
      LastName: "",
      Age: "18",
    });

    // Đánh dấu UI có thay đổi
    this._setUIChanges();

    // Cập nhật flag usernameEmpty trong appView model
    const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
    oAppViewModel?.setProperty("/usernameEmpty", true);

    // Tìm item mới tạo và focus + chọn nó
    list.getItems().some((oItem) => {
      if (oItem.getBindingContext() === context) {
        oItem.focus();
        oItem.setSelected(true);
        return true; // dừng vòng lặp
      }
      return false;
    });
  }

  public onSave(): void {
    const oModel = this.getView()?.getModel() as ODataModelV2 | undefined;
    if (!oModel) return;

    this._setBusy(true); // lock UI

    oModel.submitChanges({
      groupId: "peopleGroup",
      success: async () => {
        // Sau khi commit thành công, pending changes = false
        this._setUIChanges(false);
        this._setBusy(false);

        const sMessage = await this._getText("changesSentMessage");
        MessageToast.show(sMessage);
      },
      error: (oError: { message: string }) => {
        this._setUIChanges(true); // vẫn coi là pending nếu lỗi
        this._setBusy(false);
        MessageBox.error(oError.message);
      },
    });

    // Reset technical errors
    this._bTechnicalErrors = false;
  }

  private _setBusy(bIsBusy: boolean): void {
    // Lấy JSONModel "appView"
    const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;

    // Cập nhật property /busy
    oAppViewModel?.setProperty("/busy", bIsBusy);
  }

  public onMessageBindingChange(oEvent: Event): void {
    // Lấy binding từ event source
    const oBinding = oEvent.getSource() as ListBinding;
    const aContexts = oBinding.getContexts() as Context[];

    // Cờ để đảm bảo MessageBox không mở nhiều lần
    let bMessageOpen = false;

    if (bMessageOpen || aContexts.length === 0) {
      return;
    }

    // Chuyển đổi các context thành instance Message
    const aMessages = aContexts.map((oContext) => oContext.getObject() as Message).filter(Boolean); // lọc undefined nếu có

    // Xóa các message khỏi MessageManager
    sap.ui.getCore().getMessageManager().removeMessages(aMessages);

    // Đánh dấu UI có thay đổi
    this._setUIChanges(true);
    this._bTechnicalErrors = true;

    // Hiển thị MessageBox lỗi
    MessageBox.error(aMessages[0].getMessage(), {
      id: "serviceErrorMessageBox",
      onClose: () => {
        bMessageOpen = false;
      },
    });

    bMessageOpen = true;
  }

  public onResetChanges(): void {
    // Lấy Table
    const oList = this.byId("peopleList") as Table | undefined;

    // Lấy binding items
    const oBinding = oList?.getBinding("items") as unknown as { resetChanges?: () => void };

    // Gọi resetChanges() nếu tồn tại
    oBinding?.resetChanges?.();

    // Reset cờ technical errors
    this._bTechnicalErrors = false;

    // Cập nhật UI changes flag
    this._setUIChanges();
  }

  public onInputChange(oEvt: Event): void {
    // Lấy control Input gây ra event
    const oInput = oEvt.getSource() as Input;

    // Kiểm tra nếu người dùng nhấn ESC (nếu event hỗ trợ)
    // TS không biết "escPressed", nên có thể dùng optional chaining
    const bEscPressed = (oEvt as any).getParameter?.("escPressed") as boolean | undefined;

    if (bEscPressed) {
      // Nếu ESC được nhấn, chỉ cập nhật UI changes flag mà không đánh dấu true
      this._setUIChanges();
    } else {
      // Lấy giá trị hiện tại từ Input
      const sUserName = oInput.getValue() || "";

      // Cập nhật UI changes flag
      this._setUIChanges(!!sUserName);

      // Cập nhật flag usernameEmpty trong appView model
      const oAppViewModel = this.getView()?.getModel("appView") as JSONModel | undefined;
      oAppViewModel?.setProperty("/usernameEmpty", sUserName.trim() === "");
    }
  }
}

// onRefresh được async để có thể await _getText.
// Kiểm tra model và binding trước khi gọi các method để tránh TS lỗi possibly undefined.
// _getText luôn trả về string (fallback sTextId) nếu bundle chưa load hoặc bị lỗi.
// Loại bỏ duplicate binding.refresh() và MessageToast.show().
